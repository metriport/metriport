import {
  BadRequestError,
  errorToString,
  normalizeEmailNew,
  normalizePhoneNumberStrict,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { Contact } from "../../../domain/contact";
import { ParsingError } from "./shared";

const maxContacts = 10;

/**
 * Maps a record/map of CSV patient data to a Metriport patient's contacts.
 *
 * NOTE: when parsing columns, csv-parser populates them in lower-case, so
 * the property names are all lower-case.
 *
 * @param csvPatient - The CSV patient data.
 * @returns The Metriport patient's contacts, with errors indicated on the errors array.
 */
export function mapCsvContacts(csvPatient: Record<string, string | undefined>): {
  contacts: Contact[];
  errors: ParsingError[];
} {
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
  return { contacts: filteredContacts, errors };
}

function parseContact(
  csvPatient: Record<string, string | undefined>,
  index: number | undefined
): { contact: Contact | undefined; errors: ParsingError[] } {
  const errors: ParsingError[] = [];
  const indexSuffix = index ? `-${index}` : "";
  const emailName = `email${indexSuffix}`;
  const phoneName = `phone${indexSuffix}`;

  let email: string | undefined = undefined;
  try {
    email = normalizeEmail(csvPatient[emailName], emailName);
  } catch (error) {
    errors.push({ field: emailName, error: errorToString(error) });
  }

  let phone: string | undefined = undefined;
  try {
    phone = normalizePhoneNumber(csvPatient[phoneName], phoneName);
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

export function normalizePhoneNumber(
  phone: string | undefined,
  propName: string
): string | undefined {
  if (phone == undefined || phone.trim().length < 1) return undefined;
  try {
    const normalPhone = normalizePhoneNumberStrict(phone);
    return normalPhone;
  } catch (error) {
    throw new BadRequestError(`Invalid ${propName}`);
  }
}

export function normalizeEmail(email: string | undefined, propName: string): string | undefined {
  if (email == undefined || email.trim().length < 1) return undefined;
  try {
    const normalEmail = normalizeEmailNew(email);
    return normalEmail;
  } catch (error) {
    throw new BadRequestError(`Invalid ${propName}`);
  }
}
