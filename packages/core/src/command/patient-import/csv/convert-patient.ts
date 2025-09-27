import {
  BadRequestError,
  errorToString,
  GenderAtBirth,
  MetriportError,
  normalizeDobSafe,
  normalizeExternalId as normalizeExternalIdFromShared,
  normalizeGenderSafe,
  normalizeUSStateForAddressSafe,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { toTitleCaseIfNotMultiCase } from "@metriport/shared/common/title-case";
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
import _ from "lodash";

const firstNameFieldName = "firstName";
const lastNameFieldName = "lastName";
const dobFieldName = "dob";
const genderFieldName = "gender";
const ssnFieldName = "ssn";
const externalIdFieldName = "id";
const externalId2FieldName = "externalId";
const cohort1FieldName = "cohort1";
const cohort2FieldName = "cohort2";
const firstNameFieldNameLower = firstNameFieldName.toLowerCase();
const lastNameFieldNameLower = lastNameFieldName.toLowerCase();
const dobFieldNameLower = dobFieldName.toLowerCase();
const genderFieldNameLower = genderFieldName.toLowerCase();
const ssnFieldNameLower = ssnFieldName.toLowerCase();
const externalIdFieldNameLower = externalIdFieldName.toLowerCase();
const externalId2FieldNameLower = externalId2FieldName.toLowerCase();
const cohort1FieldNameLower = cohort1FieldName.toLowerCase();
const cohort2FieldNameLower = cohort2FieldName.toLowerCase();

const driversLicensePrefixUS = "driversLicense"; // licenSe
const driversLicensePrefixGB = "driversLicence"; // licenCe
const driversLicenseSuffixEmpty = "";
const driversLicenseSuffixNo = "No";
const driversLicenseSuffixNumber = "Number";
const driversLicenseSuffixValue = "Value";
const driversLicenseStateSuffix = "State";

const driversLicenseFieldNames = [driversLicensePrefixUS, driversLicensePrefixGB].flatMap(p => [
  p + driversLicenseSuffixEmpty,
  p + driversLicenseSuffixValue,
  p + driversLicenseSuffixNo,
  p + driversLicenseSuffixNumber,
]);

const driversLicenseStateFieldNames = [driversLicensePrefixUS, driversLicensePrefixGB].flatMap(
  p => [p + driversLicenseStateSuffix]
);

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
  csvPatient: Record<string, string | undefined>
): PatientPayload | ParsingError[] {
  const errors: ParsingError[] = [];

  let firstName: string | undefined = undefined;
  try {
    firstName = normalizeNameOrFail(csvPatient[firstNameFieldNameLower], firstNameFieldName);
  } catch (error) {
    errors.push({ field: firstNameFieldName, error: errorToString(error) });
  }

  let lastName: string | undefined = undefined;
  try {
    lastName = normalizeNameOrFail(csvPatient[lastNameFieldNameLower], lastNameFieldName);
  } catch (error) {
    errors.push({ field: lastNameFieldName, error: errorToString(error) });
  }

  let dob: string | undefined = undefined;
  try {
    const dobValue = csvPatient[dobFieldNameLower] ?? "";
    dob = normalizeDobSafe(dobValue);
    if (!dob) throw new BadRequestError(`Missing/invalid dob`);
  } catch (error) {
    errors.push({ field: dobFieldName, error: errorToString(error) });
  }

  let genderAtBirth: GenderAtBirth | undefined = undefined;
  try {
    genderAtBirth = normalizeGenderSafe(csvPatient[genderFieldNameLower] ?? "");
    if (!genderAtBirth) throw new BadRequestError(`Missing/invalid gender`);
  } catch (error) {
    errors.push({ field: genderFieldName, error: errorToString(error) });
  }

  const { addresses, errors: addressErrors } = mapCsvAddresses(csvPatient);
  errors.push(...addressErrors);
  if (addresses.length < 1) {
    errors.push({ field: "address", error: "Missing address" });
  }

  const { contacts, errors: contactErrors } = mapCsvContacts(csvPatient);
  errors.push(...contactErrors);

  const externalId =
    normalizeExternalId(csvPatient[externalIdFieldNameLower]) ??
    normalizeExternalId(csvPatient[externalId2FieldNameLower]);

  const cohorts = _.compact([
    normalizeCohortName(csvPatient[cohort1FieldNameLower]),
    normalizeCohortName(csvPatient[cohort2FieldNameLower]),
  ]);

  const { ssn, errors: ssnErrors } = mapCsvSsn(csvPatient);
  errors.push(...ssnErrors);
  const { driversLicense, errors: driversLicenseErrors } = mapCsvDriversLicense(csvPatient);
  errors.push(...driversLicenseErrors);
  const personalIdentifiers: PersonalIdentifier[] = [ssn, driversLicense].flatMap(filterTruthy);

  if (errors.length > 0) {
    return errors;
  }
  if (!firstName || !lastName || !dob || !genderAtBirth || addresses.length < 1) {
    // Checking those here again to comply with types
    return [{ field: "general", error: "Missing required fields" }];
  }
  const ptCreate: PatientPayload = {
    externalId,
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address: addresses,
    contact: contacts,
    personalIdentifiers,
    cohorts,
  };
  // TODO ENG-467 Enable this when we move the validate to packages/core
  // validate(ptCreate);
  return ptCreate;
}

export function normalizeNameOrFail(name: string | undefined, propName: string): string {
  const trimmedName = name?.trim();
  if (trimmedName == undefined || trimmedName.length < 1) {
    throw new BadRequestError(`Missing ` + propName);
  }
  return toTitleCaseIfNotMultiCase(trimmedName);
}

export function normalizeCohortName(cohortName: string | undefined): string | undefined {
  return cohortName?.trim().toUpperCase();
}

export function normalizeExternalId(id: string | undefined): string | undefined {
  if (id == undefined) return undefined;
  const normalId = normalizeExternalIdFromShared(id);
  if (normalId.length < 1) return undefined;
  return normalId;
}

export function mapCsvSsn(csvPatient: Record<string, string | undefined>): {
  ssn: PersonalIdentifier | undefined;
  errors: ParsingError[];
} {
  try {
    const ssn = csvPatient[ssnFieldNameLower];
    if (!ssn || ssn.trim().length < 1) return { ssn: undefined, errors: [] };
    const normalizedSsn = normalizeSsn(ssn, true);
    return { ssn: createSsnPersonalIdentifier(normalizedSsn), errors: [] };
  } catch (error) {
    return { ssn: undefined, errors: [{ field: "ssn", error: errorToString(error) }] };
  }
}

export function mapCsvDriversLicense(csvPatient: Record<string, string | undefined>): {
  driversLicense: PersonalIdentifier | undefined;
  errors: ParsingError[];
} {
  try {
    const value = getDriversLicenseValue(csvPatient);
    const state = getDriversLicenseState(csvPatient);
    const normalizedValue = value?.trim().toUpperCase();
    const hasValue = normalizedValue && normalizedValue.length > 0;
    const hasState = !!state;
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

function getDriversLicenseValue(
  csvPatient: Record<string, string | undefined>
): string | undefined {
  let value: string | undefined = undefined;
  for (const fieldName of driversLicenseFieldNames) {
    if (csvPatient[fieldName.toLowerCase()]) {
      value = csvPatient[fieldName.toLowerCase()];
      break;
    }
  }
  return value;
}
function getDriversLicenseState(
  csvPatient: Record<string, string | undefined>
): string | undefined {
  let value: string | undefined = undefined;
  for (const fieldName of driversLicenseStateFieldNames) {
    if (csvPatient[fieldName.toLowerCase()]) {
      value = csvPatient[fieldName.toLowerCase()];
      break;
    }
  }
  return value;
}
