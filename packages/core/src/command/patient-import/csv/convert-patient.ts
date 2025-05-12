import {
  BadRequestError,
  errorToString,
  GenderAtBirth,
  MetriportError,
  normalizeDobSafe,
  normalizeExternalId as normalizeExternalIdFromShared,
  normalizeGenderSafe,
  normalizeUSStateForAddressSafe,
  toTitleCase,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { normalizeSsn } from "@metriport/shared/domain/patient/ssn";
import {
  createDriversLicensePersonalIdentifier,
  createSsnPersonalIdentifier,
  PersonalIdentifier,
} from "../../../domain/patient";
import { PatientPayload } from "../patient-import";
import { mapCsvAddresses } from "./address";
import { mapCsvContacts } from "./contact";
import { ParsingError } from "./shared";

const firstNameFieldName = "firstName";
const lastNameFieldName = "lastName";
const dobFieldName = "dob";
const genderFieldName = "gender";

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
): PatientPayload | ParsingError[] {
  const errors: ParsingError[] = [];

  let firstName: string | undefined = undefined;
  try {
    firstName = normalizeName(csvPatient.firstname ?? csvPatient.firstName, firstNameFieldName);
  } catch (error) {
    errors.push({ field: firstNameFieldName, error: errorToString(error) });
  }

  let lastName: string | undefined = undefined;
  try {
    lastName = normalizeName(csvPatient.lastname ?? csvPatient.lastName, lastNameFieldName);
  } catch (error) {
    errors.push({ field: lastNameFieldName, error: errorToString(error) });
  }

  let dob: string | undefined = undefined;
  try {
    dob = normalizeDobSafe(csvPatient.dob ?? csvPatient.DOB ?? "");
    if (!dob) throw new BadRequestError(`Missing dob or dob is not valid.`);
  } catch (error) {
    errors.push({ field: dobFieldName, error: errorToString(error) });
  }

  let genderAtBirth: GenderAtBirth | undefined = undefined;
  try {
    genderAtBirth = normalizeGenderSafe(csvPatient.gender ?? csvPatient.genderAtBirth ?? "");
    if (!genderAtBirth) throw new BadRequestError(`Missing gender`);
  } catch (error) {
    errors.push({ field: genderFieldName, error: errorToString(error) });
  }

  const { addresses, errors: addressErrors } = mapCsvAddresses(csvPatient);
  errors.push(...addressErrors);

  const { contacts, errors: contactErrors } = mapCsvContacts(csvPatient);
  errors.push(...contactErrors);

  const externalId = csvPatient.id
    ? normalizeExternalId(csvPatient.id)
    : normalizeExternalId(csvPatient.externalId) ??
      normalizeExternalId(csvPatient.externalid) ??
      undefined;

  const { ssn, errors: ssnErrors } = mapCsvSsn(csvPatient);
  errors.push(...ssnErrors);
  const { driversLicense, errors: driversLicenseErrors } = mapCsvDriversLicense(csvPatient);
  errors.push(...driversLicenseErrors);
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
  if (trimmedName == undefined || trimmedName.length < 1) {
    throw new BadRequestError(`Missing ` + propName);
  }
  return toTitleCase(trimmedName);
}

export function normalizeExternalId(id: string | undefined): string | undefined {
  if (id == undefined) return undefined;
  const normalId = normalizeExternalIdFromShared(id);
  if (normalId.length < 1) return undefined;
  return normalId;
}

export function mapCsvSsn(csvPatient: Record<string, string>): {
  ssn: PersonalIdentifier | undefined;
  errors: ParsingError[];
} {
  try {
    const ssn = csvPatient.ssn;
    if (!ssn || ssn.trim().length < 1) return { ssn: undefined, errors: [] };
    const normalizedSsn = normalizeSsn(ssn, true);
    return { ssn: createSsnPersonalIdentifier(normalizedSsn), errors: [] };
  } catch (error) {
    return { ssn: undefined, errors: [{ field: "ssn", error: errorToString(error) }] };
  }
}

export function mapCsvDriversLicense(csvPatient: Record<string, string>): {
  driversLicense: PersonalIdentifier | undefined;
  errors: ParsingError[];
} {
  try {
    const value =
      csvPatient.driverslicenceno ||
      csvPatient.driverslicencenumber ||
      csvPatient.driverslicencevalue;
    const state = csvPatient.driverslicencestate;
    const normalizedValue = value?.trim().toUpperCase();
    const hasValue = normalizedValue && normalizedValue.length > 0;
    const hasState = state;
    const errorMissingStateMsg = `Invalid drivers license (missing state)`;
    if (!hasState && hasValue) throw new BadRequestError(errorMissingStateMsg);
    if (!hasState && !hasValue) return { driversLicense: undefined, errors: [] };
    const parsedState = normalizeUSStateForAddressSafe(state ?? "");
    if (!parsedState && hasValue) throw new BadRequestError(errorMissingStateMsg);
    if (!parsedState && !hasValue) return { driversLicense: undefined, errors: [] };
    if (parsedState && !hasValue)
      throw new BadRequestError(`Invalid drivers license (missing value)`);
    if (!normalizedValue || !parsedState) throw new MetriportError(`Programming error`);
    const driversLicense = createDriversLicensePersonalIdentifier(normalizedValue, parsedState);
    return { driversLicense, errors: [] };
  } catch (error) {
    return {
      driversLicense: undefined,
      errors: [{ field: "driversLicense", error: errorToString(error) }],
    };
  }
}
