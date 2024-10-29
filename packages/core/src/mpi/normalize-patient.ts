import {
  toLowerCase,
  USState,
  normalizeEmailSafe,
  normalizePhoneSafe,
  normalizeStateSafe,
  normalizeZipCodeSafe,
  normalizeCountrySafe,
  commonReplacementsForAddressLine,
  normalizedCountryUsa,
} from "@metriport/shared";
import { normalizeNonEmptyStringSafe } from "@metriport/shared/common/string";
import { Address } from "../domain/address";
import { PatientData, splitName } from "../domain/patient";
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
  const [firstName = patient.firstName] = splitName(
    normalizeNonEmptyStringSafe(patient.firstName, toLowerCase) ?? ""
  );
  const [lastName = patient.lastName] = splitName(
    normalizeNonEmptyStringSafe(patient.lastName, toLowerCase) ?? ""
  );

  const normalizedPatient: T = {
    ...patient,
    firstName,
    lastName,
    contact: (patient.contact ?? []).map(contact => ({
      ...contact,
      email: contact.email ? normalizeEmailSafe(contact.email) : undefined,
      phone: contact.phone ? normalizePhoneSafe(contact.phone) : undefined,
    })),
    address: (patient.address ?? []).map(addr => {
      const newAddress: Address = {
        addressLine1: commonReplacementsForAddressLine(
          normalizeNonEmptyStringSafe(addr.addressLine1, toLowerCase) ?? ""
        ),
        city: normalizeNonEmptyStringSafe(addr.city, toLowerCase) ?? "",
        state: normalizeStateSafe(addr.state) ?? ("" as USState),
        zip: normalizeZipCodeSafe(addr.zip) ?? "",
        country: normalizeCountrySafe(addr.country ?? "") ?? normalizedCountryUsa,
      };
      if (addr.addressLine2) {
        newAddress.addressLine2 = commonReplacementsForAddressLine(
          normalizeNonEmptyStringSafe(addr.addressLine2, toLowerCase) ?? ""
        );
      }
      return newAddress;
    }),
  };
  log(`normalizedPatient ${JSON.stringify(normalizedPatient)}`);
  return normalizedPatient;
}

export function normalizePatientInboundMpi<T extends PatientData>(patient: T): T {
  const { log } = out(`MPI normalize patient, request id - ${patient.requestId}`);

  const firstName = normalizeNonEmptyStringSafe(patient.firstName, toLowerCase) ?? "";
  const lastName = normalizeNonEmptyStringSafe(patient.lastName, toLowerCase) ?? "";

  const normalizedPatient: T = {
    ...patient,
    firstName,
    lastName,
    contact: (patient.contact ?? []).map(contact => ({
      ...contact,
      email: contact.email ? normalizeEmailSafe(contact.email) : undefined,
      phone: contact.phone ? normalizePhoneSafe(contact.phone) : undefined,
    })),
    address: (patient.address ?? []).map(addr => {
      const newAddress: Address = {
        addressLine1: commonReplacementsForAddressLine(
          normalizeNonEmptyStringSafe(addr.addressLine1, toLowerCase) ?? ""
        ),
        city: normalizeNonEmptyStringSafe(addr.city, toLowerCase) ?? "",
        state: normalizeStateSafe(addr.state) ?? ("" as USState),
        zip: normalizeZipCodeSafe(addr.zip) ?? "",
        country: normalizeCountrySafe(addr.country ?? "") ?? normalizedCountryUsa,
      };
      if (addr.addressLine2) {
        newAddress.addressLine2 = commonReplacementsForAddressLine(
          normalizeNonEmptyStringSafe(addr.addressLine2, toLowerCase) ?? ""
        );
      }
      return newAddress;
    }),
  };
  log(`normalizePatientInboundMpi ${JSON.stringify(normalizedPatient)}`);
  return normalizedPatient;
}
