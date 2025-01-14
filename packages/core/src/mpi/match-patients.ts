import jaroWinkler from "jaro-winkler";
import { intersectionWith } from "lodash";
import { Contact } from "../domain/contact";
import { PatientData, PersonalIdentifier } from "../domain/patient";
import { normalizePatient } from "./normalize-patient";
import { PatientMPI } from "./shared";
import { out } from "../util/log";
import { splitName } from "./normalize-patient";

const { log } = out(`Patient Matching`);

// Define a type for the similarity function
type SimilarityFunction = (
  patient1: PatientData,
  patient2: PatientData,
  threshold: number
) => boolean;

type MatchingRule = (patient1: PatientData, patient2: PatientData) => boolean;

/**
 * `matchPatients` filters patients based on a similarity function, rules, and a threshold.
 *
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
  patients: PatientMPI[],
  currentPatient: PatientData,
  threshold: number,
  greedy = true
): PatientMPI[] {
  const matchFunction = (patient: PatientMPI) => {
    const normalizedPatient = normalizePatient(patient);
    if (!normalizedPatient) {
      return false;
    }
    for (const matchingRule of matchingRules) {
      if (matchingRule(currentPatient, normalizedPatient)) {
        return true;
      }
    }
    return isSimilarEnough(normalizedPatient, currentPatient, threshold);
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
  patient1: PatientData,
  patient2: PatientData
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
export function matchingContactDetailsRule(patient1: PatientData, patient2: PatientData): boolean {
  const contact1 = patient1.contact || [];
  const contact2 = patient2.contact || [];
  const isMatchPhone = intersectionWith(contact1, contact2, isSameContactByPhone).length > 0;
  if (isMatchPhone) return true;
  const isMatchEmail = intersectionWith(contact1, contact2, isSameContactByEmail).length > 0;
  return isMatchEmail;
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
  patient1: PatientData,
  patient2: PatientData,
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

export function exactMatchSimilarity(patient1: PatientData, patient2: PatientData): boolean {
  return (
    patient1.firstName === patient2.firstName &&
    patient1.lastName === patient2.lastName &&
    patient1.dob === patient2.dob &&
    patient1.genderAtBirth === patient2.genderAtBirth &&
    patient1.address?.[0]?.zip === patient2.address?.[0]?.zip
  );
}

function isSameContactByPhone(a?: Contact, b?: Contact): boolean {
  return !!a?.phone && !!b?.phone && a.phone === b.phone;
}

function isSameContactByEmail(a?: Contact, b?: Contact): boolean {
  return !!a?.email && !!b?.email && a.email === b.email;
}

function isSameIdentifierById(a?: PersonalIdentifier, b?: PersonalIdentifier): boolean {
  return (
    !!a?.value &&
    !!b?.value &&
    !!a?.type &&
    !!b?.type &&
    a.value === b.value &&
    a.type === b.type &&
    (a.type === "driversLicense" && b.type === "driversLicense" ? a.state === b.state : true)
  );
}
/**
 * Implements the EPIC matching algorithm for patient data comparison.
 * For detailed algorithm description and scoring logic, refer to:
 * https://docs.google.com/document/d/1XgY-4AbBDpnQdiEcOuBe9It_i7oNuPYgIJM44FUSI3E/edit
 */

export function epicMatchingAlgorithm(
  patient1: PatientData,
  patient2: PatientData,
  threshold: number
): boolean {
  const scores = {
    dob: 0,
    gender: 0,
    names: 0,
    address: 0,
    phone: 0,
    email: 0,
    ssn: 0,
  };

  if (patient1.dob && patient2.dob && patient1.dob === patient2.dob) {
    scores.dob = 8;
  } else if (patient1.dob && patient2.dob) {
    const dob1Split = splitDob(patient1.dob);
    const dob2Split = splitDob(patient2.dob);
    const overlappingDateParts = dob2Split.filter(dp => dob1Split.includes(dp));
    if (overlappingDateParts.length >= 2) {
      scores.dob = 2;
    }
  }

  if (patient1.genderAtBirth && patient2.genderAtBirth) {
    if (patient1.genderAtBirth === patient2.genderAtBirth) {
      scores.gender = 1;
    }
  }

  const firstNames1 = splitName(patient1.firstName);
  const firstNames2 = splitName(patient2.firstName);

  const lastNames1 = splitName(patient1.lastName);
  const lastNames2 = splitName(patient2.lastName);

  const hasMatchingFirstName = firstNames1.some(name => firstNames2.includes(name));
  const hasMatchingLastName = lastNames1.some(name => lastNames2.includes(name));

  if (hasMatchingFirstName && hasMatchingLastName) {
    scores.names = 10;
  } else if (hasMatchingFirstName || hasMatchingLastName) {
    scores.names = 5;
  }

  const addressMatch = patient1.address.some(addr1 =>
    patient2.address.some(addr2 => JSON.stringify(addr1) === JSON.stringify(addr2))
  );
  if (addressMatch) {
    scores.address = 2;
  } else {
    const cityMatch = patient1.address.some(addr1 =>
      patient2.address.some(addr2 => addr1.city === addr2.city)
    );
    const zipMatch = patient1.address.some(addr1 =>
      patient2.address.some(addr2 => addr1.zip === addr2.zip)
    );
    if (cityMatch) scores.address += 0.5;
    if (zipMatch) scores.address += 0.5;
  }

  const phoneMatch = patient1.contact?.some(c1 =>
    patient2.contact?.some(c2 => c1.phone && c2.phone && c1.phone === c2.phone)
  );
  if (phoneMatch) {
    scores.phone = 2;
  }

  const emailMatch = patient1.contact?.some(c1 =>
    patient2.contact?.some(c2 => c1.email && c2.email && c1.email === c2.email)
  );
  if (emailMatch) {
    scores.email = 2;
  }

  const ssn1 = patient1.personalIdentifiers?.filter(id => id.type === "ssn").map(id => id.value);
  const ssn2 = patient2.personalIdentifiers?.filter(id => id.type === "ssn").map(id => id.value);
  if (ssn1?.length && ssn2?.length) {
    const ssnMatch = ssn1.some(s1 => ssn2.includes(s1));
    if (ssnMatch) {
      scores.ssn = 5;
    }
  }

  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);

  if (ssn1?.length && ssn2?.length) {
    const newThreshold = threshold + 1;
    const match = totalScore >= newThreshold;
    if (match) {
      log(
        `Match: ${match}, Score: ${totalScore}, Threshold: ${newThreshold}, Total Scores: ${JSON.stringify(
          scores
        )}, Patient1: ${JSON.stringify(patient1)}, Patient2: ${JSON.stringify(patient2)}`
      );
    }
    return match;
  }

  const match = totalScore >= threshold;
  if (match) {
    log(
      `Match: ${match}, Score: ${totalScore}, Threshold: ${threshold}, Total Scores: ${JSON.stringify(
        scores
      )}, Patient1: ${JSON.stringify(patient1)}, Patient2: ${JSON.stringify(patient2)}`
    );
  }
  return match;
}

function splitDob(dob: string): string[] {
  return dob.split(/[-/]/);
}
