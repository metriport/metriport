import {
  USState,
  normalizeStringSafe,
  normalizeEmailSafe,
  normalizePhoneSafe,
  normalizeStateSafe,
  normalizeZipCodeSafe,
  normalizeCountrySafe,
  commonReplacementsForAddressLine,
  normalizedCountryUsa,
} from "@metriport/shared";
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
  const [firstName = patient.firstName] = splitName(normalizeStringSafe(patient.firstName) ?? "");
  const [lastName = patient.lastName] = splitName(normalizeStringSafe(patient.lastName) ?? "");

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
      const normalizedCountryString = normalizeStringSafe(addr.country ?? "");
      const newAddress: Address = {
        addressLine1: commonReplacementsForAddressLine(
          normalizeStringSafe(addr.addressLine1) ?? ""
        ),
        city: normalizeStringSafe(addr.city) ?? "",
        state: normalizeStateSafe(addr.state) ?? ("" as USState),
        zip: normalizeZipCodeSafe(addr.zip) ?? "",
        country: normalizeCountrySafe(normalizedCountryString ?? normalizedCountryUsa) ?? "",
      };
      if (addr.addressLine2) {
        newAddress.addressLine2 = commonReplacementsForAddressLine(
          normalizeStringSafe(addr.addressLine2) ?? ""
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

  const firstName = normalizeStringSafe(patient.firstName) ?? "";
  const lastName = normalizeStringSafe(patient.lastName) ?? "";

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
      const normalizedCountryString = normalizeStringSafe(addr.country ?? "");
      const newAddress: Address = {
        addressLine1: commonReplacementsForAddressLine(
          normalizeStringSafe(addr.addressLine1) ?? ""
        ),
        city: normalizeStringSafe(addr.city) ?? "",
        state: normalizeStateSafe(addr.state) ?? ("" as USState),
        zip: normalizeZipCodeSafe(addr.zip) ?? "",
        country: normalizeCountrySafe(normalizedCountryString ?? normalizedCountryUsa) ?? "",
      };
      if (addr.addressLine2) {
        newAddress.addressLine2 = commonReplacementsForAddressLine(
          normalizeStringSafe(addr.addressLine2) ?? ""
        );
      }
      return newAddress;
    }),
  };
  log(`normalizePatientInboundMpi ${JSON.stringify(normalizedPatient)}`);
  return normalizedPatient;
}
