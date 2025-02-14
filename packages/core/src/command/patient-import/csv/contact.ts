import {
  isEmailValid,
  isPhoneValid,
  normalizeEmail,
  normalizePhoneNumber,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { Contact } from "../../../domain/contact";
import { ParsingError } from "./shared";

const maxContacts = 10;

export function mapCsvContacts(csvPatient: Record<string, string>): {
  contacts: Contact[];
  errors: ParsingError[];
} {
  const errors: ParsingError[] = [];
  const contacts: (Contact | undefined)[] = [];

  const { contact, errors: errorsNoIdx } = parseContact(csvPatient, undefined);
  contacts.push(contact);
  errors.push(...errorsNoIdx);

  for (let i = 1; i <= 10; i++) {
    const { contact, errors: errorsIdx } = parseContact(csvPatient, i);
    contacts.push(contact);
    errors.push(...errorsIdx);
  }

  const filteredContacts = contacts.flatMap(filterTruthy);
  if (filteredContacts.length > maxContacts) {
    errors.push({
      field: "address",
      error: `Found more than 10 contacts`,
    });
  }

  return { contacts: filteredContacts, errors };
}

function parseContact(
  csvPatient: Record<string, string>,
  index: number | undefined
): { contact: Contact | undefined; errors: ParsingError[] } {
  const errors: ParsingError[] = [];
  const indexSuffix = index ? `-${index}` : "";

  let email: string | undefined = undefined;
  try {
    email = normalizeEmailUtils(csvPatient[`email${indexSuffix}`]);
  } catch (error) {
    errors.push({
      field: `email${indexSuffix}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let phone: string | undefined = undefined;
  try {
    phone = normalizePhoneNumberUtils(csvPatient[`phone${indexSuffix}`]);
  } catch (error) {
    errors.push({
      field: `phone${indexSuffix}`,
      error: error instanceof Error ? error.message : String(error),
    });
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

export function normalizePhoneNumberUtils(phone: string | undefined): string | undefined {
  if (phone == undefined) return undefined;
  const normalPhone = normalizePhoneNumber(phone);
  if (normalPhone.length === 0) return undefined;
  if (!isPhoneValid(normalPhone)) throw new Error("Invalid Phone");
  return normalPhone;
}

export function normalizeEmailUtils(email: string | undefined): string | undefined {
  if (email == undefined) return undefined;
  const normalEmail = normalizeEmail(email);
  if (normalEmail.length === 0) return undefined;
  if (!isEmailValid(normalEmail)) throw new Error("Invalid Email");
  return normalEmail;
}
