import { USState } from "@metriport/api-sdk/medical/models/common/us-data";
import jaroWinkler from "jaro-winkler";
import { PatientDataMPI } from "../mpi/patient-incoming-schema";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.
const SIMILARITY_THRESHOLD = 0.9;
export function isAnyPatientMatching(patientToMatch: PatientDataMPI): PatientDataMPI | undefined {
  const patients = [patient_1, patient_2, patient_3];
  for (const patient of patients) {
    if (isPatientMatching(patient, patientToMatch)) {
      return patient;
    }
  }
  return undefined;
}

// checks if patient is matching
export const isPatientMatching = (patient1: PatientDataMPI, patient2: PatientDataMPI): boolean => {
  let score = 0;
  let fieldCount = 0;

  const addScore = (value1: string, value2: string) => {
    const similarity = jaroWinkler(value1.toLowerCase(), value2.toLowerCase());
    score += similarity;
    fieldCount += 1;
  };

  addScore(patient1.firstName, patient2.firstName);
  addScore(patient1.lastName, patient2.lastName);
  addScore(patient1.dob, patient2.dob);
  addScore(patient1.genderAtBirth, patient2.genderAtBirth);

  const totalScore = score / fieldCount;
  return totalScore >= SIMILARITY_THRESHOLD;
};

// patients
const patient_1 = {
  id: "EV38NJT4M6Q2B5X",
  documentId: "1.2.840.114350.1.13.11511.3.7.8.456721.987654",
  firstName: "Skwisgaar",
  lastName: "Skwigelf",
  dob: "1969-04-20",
  genderAtBirth: "M" as "F" | "M",
  address: [
    {
      addressLine1: "2517 Durant Ave",
      city: "Berkeley",
      state: "CA" as USState,
      zip: "94704",
      // eslint-disable-next-line @typescript-eslint/prefer-as-const
      country: "USA" as "USA",
    },
  ],
  contact: [
    {
      phone: "666-666-6666",
    },
  ],
};

const patient_2 = {
  id: "EV72KHP9L1C3FA4",
  documentId: "1.2.840.114350.1.13.11511.3.7.8.234587.334455",
  firstName: "Federico",
  lastName: "Aufderhar",
  dob: "1981-07-12",
  genderAtBirth: "M" as "F" | "M",
  address: [
    {
      addressLine1: "237 Hegmann Avenue",
      city: "Berkley",
      state: "MA" as USState,
      zip: "02779 1234",
      // eslint-disable-next-line @typescript-eslint/prefer-as-const
      country: "USA" as "USA",
    },
  ],
  contact: [
    {
      phone: "1-234-567-8910",
    },
  ],
};

const patient_3 = {
  id: "EV51WRZ8G7D6H9Y",
  documentId: "1.2.840.114350.1.13.11511.3.7.8.123456.789012",
  firstName: "NWHINONE",
  lastName: "NWHINZZZTESTPATIENT",
  dob: "1981-01-01",
  genderAtBirth: "M" as "F" | "M",
  address: [
    {
      addressLine1: "1100 Test Street",
      city: "Helena",
      state: "AL" as USState,
      zip: "35080",
      // eslint-disable-next-line @typescript-eslint/prefer-as-const
      country: "USA" as "USA",
    },
  ],
  contact: [
    {
      phone: "205-111-1111",
    },
  ],
};
