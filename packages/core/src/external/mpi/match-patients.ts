import { intersectionWith, isEqual } from "lodash";
import { PatientDataMPI } from "./patient-incoming-schema";
import { normalizePatientDataMPI } from "./normalize-patient";
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
export const matchPatients = (
  similarityFunction: SimilarityFunction,
  matchingRules: MatchingRule[],
  patients: PatientDataMPI[],
  demo: PatientDataMPI,
  threshold: number,
  greedy = true
): PatientDataMPI[] => {
  const matchFunction = (patient: PatientDataMPI) => {
    const PatientDataMPI = normalizePatientDataMPI(patient);
    if (!PatientDataMPI) {
      return false;
    }
    for (const rule of matchingRules) {
      if (rule(demo, PatientDataMPI)) {
        return true;
      }
    }
    return similarityFunction(PatientDataMPI, demo, threshold);
  };
  if (greedy) {
    const foundPatient = patients.find(matchFunction);
    return foundPatient ? [foundPatient] : [];
  } else {
    return patients.filter(matchFunction);
  }
};

/**
 * This function checks if the patient has any personal identifiers that match the demo. The idea of having rules
 * is that rules will override statistical similarity methods. This rule should act as an override.
 * @param demo
 * @param patient
 * @returns true if the patient has any personal identifiers that match the demo.
 */
export const matchingPersonalIdentifiersRule = (
  demo: PatientDataMPI,
  patient: PatientDataMPI
): boolean => {
  return Boolean(
    intersectionWith(patient.personalIdentifiers || [], demo.personalIdentifiers || [], isEqual)
      .length > 0
  );
};

/**
 * This function checks if the patient has any contact details (phone or email) that match the demo. The idea of this rule
 * us that contact info is a very strong unique identifier if they do match, but doesn't necessarily mean that the patients
 * don't match if they don't match.
 * @param demo
 * @param patient
 * @returns true if the patient has any contact details that match the demo.
 */
export const matchingContactDetailsRule = (
  demo: PatientDataMPI,
  patient: PatientDataMPI
): boolean => {
  // Boolean so if undefined || undefined, result will be false and not just falsy
  return Boolean(
    intersectionWith(patient.contact || [], demo.contact || [], (a, b) => a?.phone === b?.phone)
      .length > 0 ||
      intersectionWith(patient.contact || [], demo.contact || [], (a, b) => a?.email === b?.email)
        .length > 0
  );
};

/**
 * This function calculates the similarity between two patients using the Jaro-Winkler algorithm.
 * It returns a score between 0 and 1, where 1 means the patients are identical. We calculate scores
 * for the following fields: First Name, Last Name, Address Line 1, Address Line 2, City, State, Country, Zipcode.
 * This function won't be called if gender and DOB are not identical, so that is a given.
 * @param patient1
 * @param patient2
 * @returns The average of the similarity scores for each field.
 */
export const jaroWinklerSimilarity = (
  patient1: PatientDataMPI,
  patient2: PatientDataMPI,
  threshold: number
): boolean => {
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
};
