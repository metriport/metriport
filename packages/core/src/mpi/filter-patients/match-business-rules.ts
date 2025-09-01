import { buildDayjs } from "@metriport/shared/common/date";
import { PatientData } from "../../domain/patient";
import { calculateLastNameScore } from "./match-name";

export function checkBusinessRules(
  metriportPatient: PatientData,
  externalPatient: PatientData,
  scores: {
    dob: number;
    gender: number;
    names: number;
    address: number;
    phone: number;
    email: number;
    ssn: number;
  }
): string | null {
  // Rule: If first name and last name don't match at all, patient should not match
  if (scores.names === 0) {
    return "No Name Match";
  }

  // Rule: If last name is wrong and address is incorrect, it's not the same person
  if (isLastNameAndAddressMismatch(metriportPatient, externalPatient, scores)) {
    return "Last Name Wrong + Address Incorrect";
  }

  // Rule: If DOB has 2+ parts wrong and address isn't the same, it's probably not the same person
  if (scores.dob <= 1 && scores.address < 2) {
    return "DOB 2+ Parts Wrong + Address Not Same";
  }

  // Rule: If DOB has 1 part wrong and address is not perfect, it isn't the same person
  // unless phone or email is the same
  if (scores.dob === 2 && scores.address < 2) {
    if (hasNoContact(scores)) {
      return "DOB 1 Part Wrong + Address Not Perfect + No Contact Match";
    }
  }

  // Rule: If DOB is off by more than 15 years AND no part of the DOB matches, don't consider it a match
  if (scores.dob === 0 && isDobOffByMoreThan15Years(metriportPatient, externalPatient)) {
    return "DOB Off By More Than 15 Years + No Parts Match";
  }

  // Rule: If name and address are not exact matches AND contact is also not a match, it's not the same person
  if (isNameAddressAndContactMismatch(scores)) {
    return "Name + Address + Contact All Mismatch";
  }

  return null; // No business rules triggered
}

function isLastNameAndAddressMismatch(
  metriportPatient: PatientData,
  externalPatient: PatientData,
  scores: {
    address: number;
  }
): boolean {
  return !calculateLastNameScore(metriportPatient, externalPatient) && scores.address < 2;
}

function isNameAddressAndContactMismatch(scores: {
  names: number;
  address: number;
  phone: number;
  email: number;
}): boolean {
  const nameNotExact = scores.names < 10;
  const addressNotExact = scores.address < 2;
  const contactNotMatch = scores.phone === 0 && scores.email === 0;

  const result = nameNotExact && addressNotExact && contactNotMatch;

  return result;
}

function hasNoContact(scores: { phone: number; email: number }): boolean {
  return scores.phone === 0 && scores.email === 0;
}

function isDobOffByMoreThan15Years(
  metriportPatient: PatientData,
  externalPatient: PatientData
): boolean {
  if (!metriportPatient.dob || !externalPatient.dob) {
    return false; // Can't determine if we don't have both DOBs
  }

  try {
    const dayjs1 = buildDayjs(metriportPatient.dob, "YYYY-MM-DD", true);
    const dayjs2 = buildDayjs(externalPatient.dob, "YYYY-MM-DD", true);

    // Check if dates are valid
    if (!dayjs1.isValid() || !dayjs2.isValid()) {
      return false;
    }

    // Calculate the difference in years
    const yearDiff = Math.abs(dayjs1.year() - dayjs2.year());

    return yearDiff > 15;
  } catch (error) {
    return false; // If there's any error parsing dates, don't apply this rule
  }
}
