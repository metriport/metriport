import {
  errorToString,
  normalizePhoneNumber as normalizePhoneNumberFromShared,
  normalizeZipCodeNew,
} from "@metriport/shared";
import { Address } from "../domain/address";
import { PatientData } from "../domain/patient";
import { out } from "../util/log";

/**
 * Takes in patient data and normalizes it by splitting the first and last names,
 * normalizing email and phone numbers, and formatting the address.
 *
 * @param patient - The patient data.
 * @returns a normalized version of the patient data. If the patient data is valid, it will return the
 *    normalized patient data as an object of type `Patient`. If the patient data is null, it will
 *    return null.
 */
export function normalizePatient<T extends PatientData>(patient: T): T {
  const { log } = out(`MPI normalize patient, request id - ${patient.requestId}`);
  // array destructuring to extract the first element of the array with defaults
  const [firstName = patient.firstName] = splitName(normalizeString(patient.firstName));
  const [lastName = patient.lastName] = splitName(normalizeString(patient.lastName));

  const normalizedPatient: T = {
    ...patient,
    firstName,
    lastName,
    contact: (patient.contact ?? []).map(contact => ({
      ...contact,
      email: contact.email ? normalizeEmail(contact.email) : contact.email,
      phone: contact.phone ? normalizePhoneNumber(contact.phone) : contact.phone,
    })),
    address: (patient.address ?? []).map(addr => {
      try {
        const newAddress: Address = {
          addressLine1: normalizeAddress(addr.addressLine1),
          city: normalizeString(addr.city),
          zip: normalizeZipCodeNew(addr.zip),
          state: addr.state,
          country: addr.country || "USA",
        };
        if (addr.addressLine2) {
          newAddress.addressLine2 = normalizeAddress(addr.addressLine2);
        }
        return newAddress;
      } catch (err) {
        const msg = `Failed to parse the address for MPI`;
        log(`${msg} - error ${errorToString(err)}`);
      }
      return;
    }),
  };
  return normalizedPatient;
}

export function normalizePatientInboundMpi<T extends PatientData>(patient: T): T {
  const { log } = out(`MPI normalize patient, request id - ${patient.requestId}`);

  const firstName = normalizeString(patient.firstName);
  const lastName = normalizeString(patient.lastName);

  const normalizedPatient: T = {
    ...patient,
    firstName,
    lastName,
    contact: (patient.contact ?? []).map(contact => ({
      ...contact,
      email: contact.email ? normalizeEmail(contact.email) : contact.email,
      phone: contact.phone ? normalizePhoneNumber(contact.phone) : contact.phone,
    })),
    address: (patient.address ?? []).map(addr => {
      try {
        const newAddress: Address = {
          // TODO 2368 address normalization needs improvements
          // https://github.com/metriport/metriport-internal/issues/2368
          addressLine1: normalizeAddress(addr.addressLine1),
          city: normalizeString(addr.city),
          zip: normalizeZipCodeNew(addr.zip),
          state: addr.state,
          country: addr.country || "USA",
        };
        if (addr.addressLine2) {
          newAddress.addressLine2 = normalizeAddress(addr.addressLine2);
        }
        return newAddress;
      } catch (err) {
        const msg = `Failed to parse the address for MPI`;
        log(`${msg} - error ${errorToString(err)}`);
      }
      return;
    }),
  };
  return normalizedPatient;
}

/**
 * The normalizeString function takes a string as input, removes leading and trailing whitespace,
 * converts all characters to lowercase, and removes any apostrophes or hyphens.
 * @param {string} str - The `str` parameter is a string that represents the input string that needs to
 * be normalized.
 * @returns a normalized version of the input string.
 */
function normalizeString(str: string): string {
  return str.trim().toLowerCase(); //.replace(/['-]/g, "");
}

/**
 * Normalizes an email address by removing leading and trailing spaces, converting all characters to lowercase
 * and removing the "mailto:" prefix if present.
 *
 * @param email - The email address to be normalized.
 * @returns The normalized email address.
 */
export function normalizeEmail(email: string): string {
  const trimmedEmail = email.trim().toLowerCase();
  return trimmedEmail.replace(/^mailto:/i, "");
}

/**
 * Normalizes a phone number by removing all non-numeric characters and, if applicable, removing the country code.
 * @deprecated use `normalizePhoneNumber` from `@metriport/shared` instead.
 * @param phoneNumber - The phone number to be normalized.
 * @returns The normalized phone number as a string.
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  return normalizePhoneNumberFromShared(phoneNumber);
}

// TODO maybe want to have a rule that we will only normalize a single word in the address. If there are multiple, then
// we will not normalize. This is because we don't want to normalize something like "123 boulevard rd" to "123 blvd rd"

/**
 * The function `normalizeAddress` takes a string representing an address and replaces common street
 * suffixes with their abbreviated forms.
 * @param {string} address - The `address` parameter is a string that represents a street address.
 * @returns The function `normalizeAddress` returns a string.
 */
export function normalizeAddress(address: string): string {
  return normalizeString(address);
}

export function splitName(name: string): string[] {
  // splits by comma delimiter and filters out empty strings
  return name.split(/[\s,]+/).filter(str => str);
}
