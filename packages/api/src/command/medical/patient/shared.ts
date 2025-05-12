import { Period } from "@metriport/core/domain/patient";
import {
  validateDateOfBirthSafe,
  validateDateRangeSafe,
  validateIsPastOrPresentSafe,
} from "@metriport/shared/common/date";
import { cloneDeep } from "lodash";
import { PatientCreateCmd } from "./create-patient";
import { PatientMatchCmd } from "./get-patient";
import { PatientUpdateCmd } from "./update-patient";

export function sanitize<T extends PatientCreateCmd | PatientUpdateCmd | PatientMatchCmd>(
  patient: T
): T {
  const result = cloneDeep(patient);
  result.personalIdentifiers = result.personalIdentifiers?.filter(id => id.value.trim().length > 0);
  return result;
}

export function validate<T extends PatientCreateCmd | PatientUpdateCmd | PatientMatchCmd>(
  patient: T
): boolean {
  if (!patient.address || patient.address.length < 1) return false;
  patient.personalIdentifiers?.forEach(pid => pid.period && validatePeriod(pid.period));
  return validateDateOfBirthSafe(patient.dob);
}

function validatePeriod(period: Period): boolean {
  if (period.start && period.end) {
    return (
      validateIsPastOrPresentSafe(period.start) && validateDateRangeSafe(period.start, period.end)
    );
  }
  if (period.start) {
    return validateIsPastOrPresentSafe(period.start);
  }
  return true;
}
