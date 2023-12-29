import { intersectionWith } from "lodash";
import { PatientDataMPI, Contact, PersonalIdentifier } from "./patient";
import { normalizePatient } from "./normalize-patient";
import jaroWinkler from "jaro-winkler";

// Define a type for the similarity function
type SimilarityFunction = (
  patient1: PatientDataMPI,
  patient2: PatientDataMPI,
  threshold: number
) => boolean;

type MatchingRule = (patient1: PatientDataMPI, patient2: PatientDataMPI) => boolean;

/**
 * `matchPatients` filters patients based on a similarity function, rules, and a threshold.
 * @param similarityFunction - Determines if a patient is a match.
 * @param matchingRules - Rules that determines if a patient is a match.
 * @param patients - Array of patients.
 * @param demo - Patient data to find matches for.
 * @param threshold - Minimum similarity score for a match.
 * @param greedy - If true, returns the first match. If false, returns all matches.
 * @returns matched patients.
 */
export function matchPatients(
  isSimilarEnough: SimilarityFunction,
  matchingRules: MatchingRule[],
  patients: PatientDataMPI[],
  currentPatient: PatientDataMPI,
  threshold: number,
  greedy = true
): PatientDataMPI[] {
  const matchFunction = (patientDataMPI: PatientDataMPI) => {
    const patient = normalizePatient(patientDataMPI);
    if (!patient) {
      return false;
    }
    for (const matchingRule of matchingRules) {
      if (matchingRule(currentPatient, patient)) {
        return true;
      }
    }
    return isSimilarEnough(patient, currentPatient, threshold);
  };
  if (greedy) {
    const foundPatient = patients.find(matchFunction);
    return foundPatient ? [foundPatient] : [];
  } else {
    return patients.filter(matchFunction);
  }
}

/**
 * This function checks if the patient has any personal identifiers that match the demo. The idea of having rules
 * is that rules will override statistical similarity methods. This rule should act as an override.
 * @param demo
 * @param patient
 * @returns true if the patient has any personal identifiers that match the demo.
 */
export function matchingPersonalIdentifiersRule(
  patient1: PatientDataMPI,
  patient2: PatientDataMPI
): boolean {
  const identifiers1 = patient1.personalIdentifiers || [];
  const identifiers2 = patient2.personalIdentifiers || [];
  const isMatchIdentifier =
    intersectionWith(identifiers1, identifiers2, isSameIdentifierById).length > 0;
  return isMatchIdentifier;
}

/**
 * This function checks if the patient has any contact details (phone or email) that match the demo. The idea of this rule
 * us that contact info is a very strong unique identifier if they do match, but doesn't necessarily mean that the patients
 * don't match if they don't match.
 * @param demo
 * @param patient
 * @returns true if the patient has any contact details that match the demo.
 */
export function matchingContactDetailsRule(
  patient1: PatientDataMPI,
  patient2: PatientDataMPI
): boolean {
  const contact1 = patient1.contact || [];
  const contact2 = patient2.contact || [];
  const isMatchPhone = intersectionWith(contact1, contact2, isSameContactByPhone).length > 0;
  const isMatchEmail = intersectionWith(contact1, contact2, isSameContactByEmail).length > 0;
  return isMatchPhone || isMatchEmail;
}

/**
 * This function calculates the similarity between two patients using the Jaro-Winkler algorithm.
 * It returns a score between 0 and 1, where 1 means the patients are identical. We calculate scores
 * for the following fields: First Name, Last Name, Address Line 1, Address Line 2, City, State, Country, Zipcode.
 * This function won't be called if gender and DOB are not identical, so that is a given.
 * @param patient1
 * @param patient2
 * @returns boolean if the patients are a match according to threshold.
 */
export function jaroWinklerSimilarity(
  patient1: PatientDataMPI,
  patient2: PatientDataMPI,
  threshold: number
): boolean {
  let score = 0;
  let fieldCount = 0;
  const similarityScores: { [key: string]: [number, string?, string?] } = {};

  const addScore = (field: string, value1: string, value2: string) => {
    const similarity = jaroWinkler(value1, value2);
    similarityScores[field] = [similarity, value1, value2];
    score += similarity;
    fieldCount += 1;
  };

  addScore("First Name", patient1.firstName, patient2.firstName);
  addScore("Last Name", patient1.lastName, patient2.lastName);

  // Calculate similarity for addresses
  const address1 = patient1.address?.[0];
  const address2 = patient2.address?.[0];
  if (address1 && address2) {
    addScore("Address Line 1", address1.addressLine1, address2.addressLine1);
    if (address1.addressLine2 && address2.addressLine2) {
      addScore("Address Line 2", address1.addressLine2, address2.addressLine2);
    }
    addScore("City", address1.city, address2.city);
    addScore("State", address1.state, address2.state);
    addScore("Zipcode", address1.zip, address2.zip);
  }

  // Calculate similarity for contact details
  const contact1 = patient1.contact?.[0];
  const contact2 = patient2.contact?.[0];
  if (contact1 && contact2) {
    if (contact1.phone && contact2.phone) {
      addScore("Phone", contact1.phone, contact2.phone);
    }
    if (contact1.email && contact2.email) {
      addScore("Email", contact1.email, contact2.email);
    }
  }

  const totalScore = score / fieldCount;
  similarityScores["Total Score"] = [totalScore];
  return totalScore >= threshold;
}

export function exactMatchSimilarity(patient1: PatientDataMPI, patient2: PatientDataMPI): boolean {
  return (
    patient1.firstName === patient2.firstName &&
    patient1.lastName === patient2.lastName &&
    patient1.dob === patient2.dob &&
    patient1.genderAtBirth === patient2.genderAtBirth &&
    patient1.address?.[0]?.zip === patient2.address?.[0]?.zip
  );
}

function isSameContactByPhone(a?: Contact, b?: Contact): boolean {
  return a?.phone === b?.phone;
}

function isSameContactByEmail(a?: Contact, b?: Contact): boolean {
  return a?.email === b?.email;
}

function isSameIdentifierById(a?: PersonalIdentifier, b?: PersonalIdentifier): boolean {
  return a?.value === b?.value && a?.state === b?.state && a?.type === b?.type;
}
