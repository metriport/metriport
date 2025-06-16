import { Period } from "@metriport/core/domain/patient";
import {
  validateDateOfBirth,
  validateDateRange,
  validateIsPastOrPresent,
} from "@metriport/shared/common/date";
import { cloneDeep } from "lodash";
import { PatientCreateCmd } from "./create-patient";
import { PatientMatchCmd } from "./get-patient";
import { PatientUpdateCmd } from "./update-patient";

/**
 * @deprecated TODO ENG-467 Move this to packages/core
 */
export function sanitize<T extends PatientCreateCmd | PatientUpdateCmd | PatientMatchCmd>(
  patient: T
): T {
  const result = cloneDeep(patient);
  result.personalIdentifiers = result.personalIdentifiers?.filter(id => id.value.trim().length > 0);
  return result;
}

/**
 * @deprecated TODO ENG-467 Move this to packages/core
 */
export function validate<T extends PatientCreateCmd | PatientUpdateCmd | PatientMatchCmd>(
  patient: T
): boolean {
  // TODO ENG-467 Should we require first/last names?
  if (!patient.address || patient.address.length < 1) return false;
  patient.personalIdentifiers?.forEach(pid => pid.period && validatePeriod(pid.period));
  return validateDateOfBirth(patient.dob);
}

/**
 * Validates a period.
 *
 * @param period - The period to validate.
 * @returns true if the period is valid.
 * @throws BadRequestError if the period is invalid.
 */
function validatePeriod(period: Period): true {
  if (period.start && period.end) {
    return validateIsPastOrPresent(period.start) && validateDateRange(period.start, period.end);
  }
  if (period.start) {
    return validateIsPastOrPresent(period.start);
  }
  return true;
}
