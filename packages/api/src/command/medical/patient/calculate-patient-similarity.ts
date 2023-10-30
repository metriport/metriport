import { PatientData } from "../../../domain/medical/patient";
import jaroWinkler from "jaro-winkler";

const SIMILARITY_THRESHOLD = 0.96;

export const isMatchingDemographics = (patient1: PatientData, patient2: PatientData): boolean => {
  const similarityScore = calculatePatientSimilarity(patient1, patient2);
  return similarityScore >= SIMILARITY_THRESHOLD;
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
export const calculatePatientSimilarity = (
  patient1: PatientData,
  patient2: PatientData
): number => {
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
  console.log(similarityScores);
  return totalScore;
};
