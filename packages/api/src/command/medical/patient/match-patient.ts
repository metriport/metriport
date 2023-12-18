import { intersectionWith, isEqual } from "lodash";
import { PatientData, Patient } from "../../../domain/medical/patient";
import { normalizePatientData } from "./normalize-patient";
import jaroWinkler from "jaro-winkler";

// Define a type for the similarity function
type SimilarityFunction = (
  patient1: PatientData,
  patient2: PatientData,
  threshold: number
) => boolean;

/**
 * `matchPatients` filters patients based on a similarity function and a threshold.
 * @param {SimilarityFunction} similarityFunction - Determines if a patient is a match.
 * @param {Patient[]} patients - Array of patients.
 * @param {PatientData} demo - Patient data to find matches for.
 * @param {number} threshold - Minimum similarity score for a match.
 * @returns matched patients.
 */
export const matchPatients = (
  similarityFunction: SimilarityFunction,
  patients: Patient[],
  demo: PatientData,
  threshold: number
): Patient[] => {
  return patients.filter(patient => {
    const patientData = normalizePatientData(patient.data);
    if (!patientData) {
      return false;
    }
    if (matchingPersonalIdentifiersRule(demo, patientData)) {
      return true;
    }
    return similarityFunction(patientData, demo, threshold);
  });
};

/**
 * This function checks if the patient has any personal identifiers that match the demo. The idea of having rules
 * is that rules will override statistical similarity methods. This rule should act as an override.
 * @param demo
 * @param patient
 * @returns true if the patient has any personal identifiers that match the demo.
 */
export const matchingPersonalIdentifiersRule = (
  demo: PatientData,
  patient: PatientData
): boolean => {
  if (
    demo.personalIdentifiers &&
    demo.personalIdentifiers.length > 0 &&
    intersectionWith(patient.personalIdentifiers, demo.personalIdentifiers, isEqual).length > 0
  ) {
    return true;
  }
  return false;
};

/**
 * This function checks if the patient has any contact details (phone or email) that match the demo. The idea of this rule
 * us that contact info is a very strong unique identifier if they do match, but doesn't necessarily mean that the patients
 * don't match if they don't match.
 * @param demo
 * @param patient
 * @returns true if the patient has any contact details that match the demo.
 */
export const matchingContactDetailsRule = (demo: PatientData, patient: PatientData): boolean => {
  // Check for matching phone numbers
  if (
    demo.contact &&
    demo.contact.length > 0 &&
    intersectionWith(patient.contact, demo.contact, (a, b) => a.phone === b.phone).length > 0
  ) {
    return true;
  }
  // Check for matching emails
  if (
    demo.contact &&
    demo.contact.length > 0 &&
    intersectionWith(patient.contact, demo.contact, (a, b) => a.email === b.email).length > 0
  ) {
    return true;
  }
  return false;
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
  patient1: PatientData,
  patient2: PatientData,
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
  const address1 = patient1.address && patient1.address.length > 0 ? patient1.address[0] : null;
  const address2 = patient2.address && patient2.address.length > 0 ? patient2.address[0] : null;

  if (address1 && address2) {
    if (address1.addressLine1 && address2.addressLine1) {
      addScore("Address Line 1", address1.addressLine1, address2.addressLine1);
    }

    if (address1.addressLine2 && address2.addressLine2) {
      addScore("Address Line 2", address1.addressLine2, address2.addressLine2);
    }

    if (address1.city && address2.city) {
      addScore("City", address1.city, address2.city);
    }

    if (address1.state && address2.state) {
      addScore("State", address1.state, address2.state);
    }

    addScore("Country", address1.country || "", address2.country || "");
    addScore("Zipcode", address1.zip, address2.zip);
  }

  // Calculate similarity for contact details
  const contact1 = patient1.contact && patient1.contact.length > 0 ? patient1.contact[0] : null;
  const contact2 = patient2.contact && patient2.contact.length > 0 ? patient2.contact[0] : null;

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
