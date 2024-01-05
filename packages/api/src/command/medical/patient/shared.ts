import dayjs from "dayjs";
import { cloneDeep } from "lodash";
import { Period } from "@metriport/core/domain/medical/patient";
import BadRequestError from "../../../errors/bad-request";
import { PatientCreateCmd } from "./create-patient";
import { PatientUpdateCmd } from "./update-patient";

export function sanitize<T extends PatientCreateCmd | PatientUpdateCmd>(patient: T): T {
  const result = cloneDeep(patient);
  result.personalIdentifiers = result.personalIdentifiers?.filter(id => id.value.trim().length > 0);
  return result;
}

export function validate<T extends PatientCreateCmd | PatientUpdateCmd>(patient: T): boolean {
  patient.personalIdentifiers?.forEach(pid => pid.period && validatePeriod(pid.period));
  return true;
}

function validatePeriod(period: Period): boolean {
  if (period.start && period.end) {
    return validateIsPast(period.start) && validateDateRange(period.start, period.end);
  }
  if (period.start) {
    return validateIsPast(period.start);
  }
  return true;
}

function validateIsPast(date: string): boolean {
  if (dayjs(date).isAfter(dayjs())) throw new BadRequestError(`Date must be in the past: ${date}`);
  return true;
}

function validateDateRange(start: string, end: string): boolean {
  if (dayjs(start).isAfter(end)) throw new BadRequestError(`'start' must be before 'end'`);
  return true;
}
