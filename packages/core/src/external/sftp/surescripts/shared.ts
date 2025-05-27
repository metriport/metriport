import { isPrefix, isSuffix } from "./codes";
import { GenderAtBirth } from "../../../domain/patient";

// Non-binary N is mapped to by O
type SurescriptsGender = "M" | "F" | "N" | "U";

export interface NameDemographics {
  firstName: string;
  middleName: string;
  lastName: string;
  prefix: string;
  suffix: string;
}

export function makeNameDemographics({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): NameDemographics {
  const firstNamePart = firstName.split(" ");
  const lastNamePart = lastName.split(" ");

  let prefix = "",
    suffix = "";
  if (firstNamePart.length > 1 && isPrefix(firstNamePart[0]?.toLowerCase() ?? "")) {
    prefix = firstNamePart.shift() ?? "";
  }
  if (
    lastNamePart.length > 1 &&
    isSuffix(lastNamePart[lastNamePart.length - 1]?.toLowerCase() ?? "")
  ) {
    suffix = lastNamePart.pop() ?? "";
  }

  let middleName = "";
  if (firstNamePart.length > 1) {
    middleName = firstNamePart.slice(1).join(" ");
    firstName = firstNamePart[0] ?? "";
  }

  return { firstName, middleName, lastName, prefix, suffix };
}

// Shifts the first part of the middle name to the first name for patients that were not found
export function shiftMiddleNameToFirstName(patient: NameDemographics): NameDemographics {
  const shiftedPatient = { ...patient };

  if (patient.middleName.length > 0) {
    const middleNamePart = patient.middleName.split(" ");
    shiftedPatient.firstName = [patient.firstName, middleNamePart.shift()].join(" ");
    shiftedPatient.middleName = middleNamePart.join(" ");
  }
  return shiftedPatient;
}

export function makeGenderDemographics(gender?: GenderAtBirth): SurescriptsGender {
  if (!gender) return "U";
  if (gender === "O") return "N";
  return gender;
}
