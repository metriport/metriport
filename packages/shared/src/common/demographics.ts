import { GenderAtBirth } from "../domain/gender";

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
  const firstNamePart = firstName.trim().split(" ");
  const lastNamePart = lastName.trim().split(" ");

  let prefix = "",
    suffix = "";
  if (firstNamePart.length > 1 && isPrefix(firstNamePart[0]?.toLowerCase() ?? "")) {
    prefix = firstNamePart.shift() ?? "";
  }
  if (lastNamePart.length > 1 && isSuffix(lastNamePart[lastNamePart.length - 1] ?? "")) {
    suffix = lastNamePart.pop() ?? "";
    lastName = lastNamePart.join(" ");
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

export const PREFIXES = [
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "rev",
  "st",
  "hon",
  "senator",
  "sen",
  "rep",
  "congressman",
  "congresswoman",
  "gov",
] as const;
export const SUFFIXES = [
  "jr",
  "junior",
  "sr",
  "senior",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
] as const;
export type Prefix = (typeof PREFIXES)[number];
export type Suffix = (typeof SUFFIXES)[number];

export const PREFIX_SET = new Set(PREFIXES);
export const SUFFIX_SET = new Set(SUFFIXES);

export function isPrefix(prefix: string): prefix is Prefix {
  const normalizedPrefix = prefix
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
  return PREFIX_SET.has(normalizedPrefix as Prefix);
}
export function isSuffix(suffix: string): suffix is Suffix {
  const normalizedSuffix = suffix
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
  return SUFFIX_SET.has(normalizedSuffix as Suffix);
}

export function genderMapperFromDomain<G extends string>(
  mapFromDomain: Record<GenderAtBirth, G>,
  unknownGender: G
): (gender: GenderAtBirth) => G {
  return function (gender: GenderAtBirth): G {
    if (mapFromDomain[gender]) return mapFromDomain[gender];
    return unknownGender;
  };
}

export function genderMapperToDomain<G extends string>(
  mapToDomain: Record<G, GenderAtBirth>
): (gender: G) => GenderAtBirth {
  return function (gender: G): GenderAtBirth {
    if (mapToDomain[gender]) return mapToDomain[gender];
    return "U";
  };
}
