import {
  jaroWinklerSimilarity,
  matchingPersonalIdentifiersRule,
  matchingContactDetailsRule,
} from "@metriport/core/external/mpi/match-patients";
import { PatientDataMPI } from "@metriport/core/src/external/mpi/patient-incoming-schema";
import { testPatientDataMPI } from "./test_data";

describe("normalizePatientDataMPI", () => {
  it("identifies sampleInclusions as matches", async () => {
    const searchPatient: PatientDataMPI = testPatientDataMPI.sampleSearch[0];
    testPatientDataMPI.sampleInclusions.forEach((resultData: PatientDataMPI) => {
      const resultPatient: PatientDataMPI = resultData;
      expect(jaroWinklerSimilarity(searchPatient, resultPatient, 0.96)).toBeTruthy();
    });
  });

  it("identifies sampleExclusions as non-matches", async () => {
    const searchPatient: PatientDataMPI = testPatientDataMPI.sampleSearch[0];
    testPatientDataMPI.sampleExclusions.forEach((resultData: PatientDataMPI) => {
      expect(jaroWinklerSimilarity(searchPatient, resultData, 0.96)).toBeFalsy();
    });
  });

  // suceeds for two patients with matching identifier details
  it("identifies matching personal identifiers", async () => {
    const searchPatient: PatientDataMPI = testPatientDataMPI.sampleSearch[0];
    const resultPatient: PatientDataMPI = testPatientDataMPI.sampleInclusions[0]; // Choose a matching patient
    expect(matchingPersonalIdentifiersRule(searchPatient, resultPatient)).toBeTruthy();
  });

  it("identifies non-matching personal identifiers", async () => {
    const searchPatient: PatientDataMPI = testPatientDataMPI.sampleSearch[0];
    const resultPatient: PatientDataMPI = testPatientDataMPI.sampleExclusions[0]; // Choose a non-matching patient
    expect(matchingPersonalIdentifiersRule(searchPatient, resultPatient)).toBeFalsy();
  });

  // fails for two patients without contact details
  it("identifies non existent contact details", async () => {
    const searchPatient: PatientDataMPI = testPatientDataMPI.sampleSearch[0];
    const resultPatient: PatientDataMPI = testPatientDataMPI.sampleInclusions[0];
    expect(matchingContactDetailsRule(searchPatient, resultPatient)).toBeFalsy();
  });

  it("identifies non-matching contact details", async () => {
    const searchPatient: PatientDataMPI = testPatientDataMPI.sampleSearch[0];
    const resultPatient: PatientDataMPI = testPatientDataMPI.sampleExclusions[0]; // Choose a non-matching patient
    expect(matchingContactDetailsRule(searchPatient, resultPatient)).toBeFalsy();
  });
});
