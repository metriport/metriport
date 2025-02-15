import {
  errorToString,
  GenderAtBirth,
  normalizeDobSafe,
  normalizeExternalId as normalizeExternalIdFromShared,
  normalizeGenderSafe,
  normalizeUSStateForAddressSafe,
  toTitleCase,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import {
  createDriversLicensePersonalIdentifier,
  createSsnPersonalIdentifier,
  PersonalIdentifier,
} from "../../../domain/patient";
import { PatientPayload } from "../patient-import";
import { mapCsvAddresses } from "./address";
import { mapCsvContacts } from "./contact";

export type RowError = { rowColumns: string[]; error: string };

/**
 * Maps a record/map of CSV patient data to a Metriport patient.
 *
 * NOTE: when parsing columns, csv-parser populates them in lower-case, so
 * the property names are all lower-case.
 *
 * @param csvPatient - The CSV patient data.
 * @returns The Metriport patient data.
 */
export function mapCsvPatientToMetriportPatient(
  csvPatient: Record<string, string>
): PatientPayload | Array<{ field: string; error: string }> {
  const errors: Array<{ field: string; error: string }> = [];

  let firstName: string | undefined = undefined;
  try {
    firstName = normalizeName(csvPatient.firstname, "firstname");
  } catch (error) {
    errors.push({
      field: "firstName",
      error: errorToString(error),
    });
  }

  let lastName: string | undefined = undefined;
  try {
    lastName = normalizeName(csvPatient.lastname, "lastname");
  } catch (error) {
    errors.push({
      field: "lastName",
      error: errorToString(error),
    });
  }

  let dob: string | undefined = undefined;
  try {
    dob = normalizeDobSafe(csvPatient.dob ?? "");
    if (!dob) throw new Error(`Missing dob`);
  } catch (error) {
    errors.push({ field: "dob", error: errorToString(error) });
  }

  let genderAtBirth: GenderAtBirth | undefined = undefined;
  try {
    genderAtBirth = normalizeGenderSafe(csvPatient.gender ?? "");
    if (!genderAtBirth) throw new Error(`Missing gender`);
  } catch (error) {
    errors.push({ field: "gender", error: errorToString(error) });
  }

  const { addresses, errors: addressErrors } = mapCsvAddresses(csvPatient);
  errors.push(...addressErrors);

  const { contacts, errors: contactErrors } = mapCsvContacts(csvPatient);
  errors.push(...contactErrors);

  const externalId = csvPatient.id
    ? normalizeExternalId(csvPatient.id)
    : normalizeExternalId(csvPatient.externalid) ?? undefined;

  const ssn = mapCsvSsn(csvPatient);
  const driversLicense = mapCsvDriversLicense(csvPatient);
  const personalIdentifiers: PersonalIdentifier[] = [ssn, driversLicense].flatMap(filterTruthy);

  if (errors.length > 0) {
    return errors;
  }
  if (!firstName || !lastName || !dob || !genderAtBirth || addresses.length < 1) {
    return [{ field: "general", error: "Missing required fields" }];
  }
  return {
    externalId,
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address: addresses,
    contact: contacts,
    personalIdentifiers,
  };
}

export function normalizeName(name: string | undefined, propName: string): string {
  const trimmedName = name?.trim();
  if (trimmedName == undefined || trimmedName.length < 1) throw new Error(`Missing ` + propName);
  return toTitleCase(trimmedName);
}

export function normalizeExternalId(id: string | undefined): string | undefined {
  if (id == undefined) return undefined;
  const normalId = normalizeExternalIdFromShared(id);
  if (normalId.length === 0) return undefined;
  return normalId;
}

export function mapCsvSsn(csvPatient: Record<string, string>): PersonalIdentifier | undefined {
  if (!csvPatient.ssn) return undefined;
  return createSsnPersonalIdentifier(csvPatient.ssn);
}

export function mapCsvDriversLicense(
  csvPatient: Record<string, string>
): PersonalIdentifier | undefined {
  const value = csvPatient.driverslicenceno;
  const state = csvPatient.driverslicencestate;
  const normalizedValue = value?.trim().toUpperCase();
  if (!normalizedValue || !state) return undefined;
  const parsedState = normalizeUSStateForAddressSafe(state);
  if (!parsedState) return undefined;
  return createDriversLicensePersonalIdentifier(normalizedValue, parsedState);
}
