import { errorToString, normalizeEmailNewSafe, normalizePhoneNumberSafe } from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { Contact } from "../../../domain/contact";
import { out } from "../../../util";
import { ParsingError } from "./shared";

const maxContacts = 10;

export function mapCsvContacts(csvPatient: Record<string, string>): {
  contacts: Contact[];
  errors: ParsingError[];
} {
  const { log } = out(`mapCsvContacts`);
  const errors: ParsingError[] = [];
  const contacts: (Contact | undefined)[] = [];

  const { contact, errors: errorsNoIdx } = parseContact(csvPatient, undefined);
  contacts.push(contact);
  errors.push(...errorsNoIdx);

  for (let i = 1; i <= maxContacts; i++) {
    const { contact, errors: errorsIdx } = parseContact(csvPatient, i);
    contacts.push(contact);
    errors.push(...errorsIdx);
  }

  const filteredContacts = contacts.flatMap(filterTruthy);
  if (filteredContacts.length > maxContacts) {
    log(`Found more than ${maxContacts} contacts, discarding the rest`);
    filteredContacts.splice(maxContacts);
  }

  return { contacts: filteredContacts, errors };
}

function parseContact(
  csvPatient: Record<string, string>,
  index: number | undefined
): { contact: Contact | undefined; errors: ParsingError[] } {
  const errors: ParsingError[] = [];
  const indexSuffix = index ? `-${index}` : "";
  const emailName = `email${indexSuffix}`;
  const phoneName = `phone${indexSuffix}`;

  let email: string | undefined = undefined;
  try {
    email = normalizeEmail(csvPatient[emailName]);
  } catch (error) {
    errors.push({ field: emailName, error: errorToString(error) });
  }

  let phone: string | undefined = undefined;
  try {
    phone = normalizePhoneNumber(csvPatient[phoneName]);
  } catch (error) {
    errors.push({ field: phoneName, error: errorToString(error) });
  }
  if (!email && !phone) {
    return { contact: undefined, errors };
  }
  const contact: Contact = {
    email,
    phone,
  };
  return { contact, errors };
}

export function normalizePhoneNumber(phone: string | undefined): string | undefined {
  if (phone == undefined) return undefined;
  const normalPhone = normalizePhoneNumberSafe(phone);
  return normalPhone;
}

export function normalizeEmail(email: string | undefined): string | undefined {
  if (email == undefined) return undefined;
  const normalEmail = normalizeEmailNewSafe(email);
  return normalEmail;
}
