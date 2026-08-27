import {
  errorToString,
  normalizePhoneNumber as normalizePhoneNumberFromShared,
  normalizeZipCodeNew,
  normalizeZipCodeRelaxed,
  USStateForAddress,
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
    address: (patient.address ?? []).flatMap(addr => {
      try {
        const newAddress: Address = {
          addressLine1: normalizeAddress(addr.addressLine1),
          city: normalizeString(addr.city),
          zip: normalizeZipCodeNew(addr.zip),
          state: addr.state,
          country: addr.country || "USA",
        };
        if (addr.addressLine2) {
          newAddress.addressLine2 = normalizeString(addr.addressLine2);
        }
        return newAddress;
      } catch (err) {
        const msg = `Failed to parse the address for MPI`;
        log(`${msg} - error ${errorToString(err)}`);
      }
      return [];
    }),
  };
  return normalizedPatient;
}

export type RelaxedAddress = Omit<Address, "addressLine1" | "city" | "state" | "zip"> & {
  addressLine1?: string | undefined;
  city?: string | undefined;
  state?: USStateForAddress | undefined;
  zip?: string | undefined;
};

export type PatientDataForMpiMatching = Pick<
  PatientData,
  | "firstName"
  | "lastName"
  | "contact"
  | "requestId"
  | "dob"
  | "genderAtBirth"
  | "personalIdentifiers"
> & {
  address: RelaxedAddress[];
};

export function normalizePatientInboundMpi(
  patient: PatientDataForMpiMatching
): PatientDataForMpiMatching {
  const { log } = out(`MPI normalize patient, request id - ${patient.requestId}`);

  const firstName = normalizeString(patient.firstName);
  const lastName = normalizeString(patient.lastName);

  const normalizedPatient: PatientDataForMpiMatching = {
    ...patient,
    firstName,
    lastName,
    contact: (patient.contact ?? []).map(contact => ({
      ...contact,
      email: contact.email ? normalizeEmail(contact.email) : contact.email,
      phone: contact.phone ? normalizePhoneNumber(contact.phone) : contact.phone,
    })),
    address: (patient.address ?? []).flatMap(addr => {
      try {
        const newAddress: RelaxedAddress = {
          // TODO 2368 address normalization needs improvements
          addressLine1: normalizeAddressOptional(addr.addressLine1),
          city: normalizeStringOptional(addr.city),
          zip: normalizeZipCodeRelaxed(addr.zip),
          state: addr.state,
          country: addr.country || "USA",
        };
        if (addr.addressLine2) {
          newAddress.addressLine2 = normalizeString(addr.addressLine2);
        }

        const hasLocationData =
          !!newAddress.addressLine1 || !!newAddress.city || !!newAddress.state || !!newAddress.zip;
        if (!hasLocationData) return [];

        return newAddress;
      } catch (err) {
        const msg = `Failed to parse the address for MPI`;
        log(`${msg} - error ${errorToString(err)}`);
      }
      return [];
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
export function normalizeString(str: string): string {
  return str.trim().toLowerCase(); //.replace(/['-]/g, "");
}

export function normalizeStringOptional(str?: string): string | undefined {
  if (!str) return undefined;
  return normalizeString(str);
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

export function normalizeAddress(address: string): string {
  return normalizeString(address);
}

export function normalizeAddressOptional(address?: string | undefined): string | undefined {
  return normalizeStringOptional(address);
}

export function splitName(name: string): string[] {
  // splits by comma delimiter and filters out empty strings
  return name.split(/[\s,]+/).filter(str => str);
}
