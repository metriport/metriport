import { splitName } from "../normalize-patient";
import { PatientData } from "../../domain/patient";
import { isFuzzyMatch } from "./utils";

export function calculateNameScore(
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  return (
    calculateFirstNameScore(metriportPatient, externalPatient) +
    calculateLastNameScore(metriportPatient, externalPatient)
  );
}

export function calculateFirstNameScore(
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  const firstNames1 = splitName(metriportPatient.firstName);
  const firstNames2 = splitName(externalPatient.firstName);

  const hasMatchingFirstName = firstNames1.some((name: string) => firstNames2.includes(name));
  const hasReversedFirstName = firstNames1.some((name: string) =>
    splitName(externalPatient.lastName).includes(name)
  );

  const cleanFirstName1 = metriportPatient.firstName.replace(/[\s-]/g, "");
  const cleanFirstName2 = externalPatient.firstName.replace(/[\s-]/g, "");
  const cleanLastName2 = externalPatient.lastName.replace(/[\s-]/g, "");

  const hasCleanFirstNameMatch = cleanFirstName1 === cleanFirstName2;
  const hasCleanReversedFirstName = cleanFirstName1 === cleanLastName2;
  const hasFuzzyFirstNameMatch = isFuzzyMatch(cleanFirstName1, cleanFirstName2, 0.6);
  const hasFirstNamePrefixMatch = isNamePrefixMatch(cleanFirstName1, cleanFirstName2);

  return hasMatchingFirstName ||
    hasReversedFirstName ||
    hasCleanFirstNameMatch ||
    hasCleanReversedFirstName ||
    hasFuzzyFirstNameMatch ||
    hasFirstNamePrefixMatch
    ? 5
    : 0;
}

export function calculateLastNameScore(
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  const lastNames1 = splitName(metriportPatient.lastName);
  const lastNames2 = splitName(externalPatient.lastName);

  const hasMatchingLastName = lastNames1.some((name: string) => lastNames2.includes(name));
  const hasReversedLastName = lastNames1.some((name: string) =>
    splitName(externalPatient.firstName).includes(name)
  );

  const cleanLastName1 = metriportPatient.lastName.replace(/[\s-]/g, "");
  const cleanLastName2 = externalPatient.lastName.replace(/[\s-]/g, "");
  const cleanFirstName2 = externalPatient.firstName.replace(/[\s-]/g, "");

  const hasCleanLastNameMatch = cleanLastName1 === cleanLastName2;
  const hasCleanReversedLastName = cleanLastName1 === cleanFirstName2;
  const hasFuzzyLastNameMatch = isFuzzyMatch(cleanLastName1, cleanLastName2, 0.6);
  const hasLastNamePrefixMatch = isNamePrefixMatch(cleanLastName1, cleanLastName2);

  const lastNameParts1 = metriportPatient.lastName
    .split(/[\s-]+/)
    .filter((part: string) => part.length > 1);
  const lastNameParts2 = externalPatient.lastName
    .split(/[\s-]+/)
    .filter((part: string) => part.length > 1);

  const hasMatchingLastNameParts = lastNameParts1.some((part1: string) =>
    lastNameParts2.some((part2: string) => part1 === part2)
  );

  const cleanLastNameParts1 = lastNameParts1.map((part: string) => part.replace(/[\s-]/g, ""));
  const cleanLastNameParts2 = lastNameParts2.map((part: string) => part.replace(/[\s-]/g, ""));
  const hasMatchingCleanLastNameParts = cleanLastNameParts1.some((cleanPart1: string) =>
    cleanLastNameParts2.some((cleanPart2: string) => cleanPart1 === cleanPart2)
  );

  const hasLastNameContainsMatch =
    cleanLastName1.includes(cleanLastName2) || cleanLastName2.includes(cleanLastName1);

  return hasMatchingLastName ||
    hasReversedLastName ||
    hasCleanLastNameMatch ||
    hasCleanReversedLastName ||
    hasFuzzyLastNameMatch ||
    hasLastNamePrefixMatch ||
    hasMatchingLastNameParts ||
    hasMatchingCleanLastNameParts ||
    hasLastNameContainsMatch
    ? 5
    : 0;
}

function isNamePrefixMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const shorterName = name1.length <= name2.length ? name1 : name2;
  const longerName = name1.length <= name2.length ? name2 : name1;

  if (shorterName.length < 3) return false;

  return longerName.toLowerCase().startsWith(shorterName.toLowerCase());
}
