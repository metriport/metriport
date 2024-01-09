import {
  jaroWinklerSimilarity,
  matchingPersonalIdentifiersRule,
  matchingContactDetailsRule,
} from "../match-patients";
import { PatientMPI } from "../shared";
import { testPatientMPI } from "./test_data";

/* eslint-disable @typescript-eslint/no-non-null-assertion */

describe("normalizePatientMPI", () => {
  it("identifies sampleInclusions as matches", async () => {
    const searchPatient: PatientMPI = testPatientMPI.sampleSearch[0]!;
    testPatientMPI.sampleInclusions.forEach((resultData: PatientMPI) => {
      const resultPatient: PatientMPI = resultData;
      expect(jaroWinklerSimilarity(searchPatient, resultPatient, 0.96)).toBeTruthy();
    });
  });

  it("identifies sampleExclusions as non-matches", async () => {
    const searchPatient: PatientMPI = testPatientMPI.sampleSearch[0]!;
    testPatientMPI.sampleExclusions.forEach((resultData: PatientMPI) => {
      expect(jaroWinklerSimilarity(searchPatient, resultData, 0.96)).toBeFalsy();
    });
  });

  it("identifies matching personal identifiers", async () => {
    const searchPatient: PatientMPI = testPatientMPI.sampleSearch[0]!;
    const resultPatient: PatientMPI = testPatientMPI.sampleInclusions[0]!;
    expect(matchingPersonalIdentifiersRule(searchPatient, resultPatient)).toBeTruthy();
  });

  it("identifies non-matching personal identifiers", async () => {
    const searchPatient: PatientMPI = testPatientMPI.sampleSearch[0]!;
    const resultPatient: PatientMPI = testPatientMPI.sampleExclusions[0]!; // Choose a non-matching patient
    expect(matchingPersonalIdentifiersRule(searchPatient, resultPatient)).toBeFalsy();
  });

  it("identifies non existent contact details", async () => {
    const searchPatient: PatientMPI = testPatientMPI.sampleSearch[0]!;
    const resultPatient: PatientMPI = testPatientMPI.sampleInclusions[0]!;
    expect(matchingContactDetailsRule(searchPatient, resultPatient)).toBeFalsy();
  });

  it("identifies non-matching contact details", async () => {
    const searchPatient: PatientMPI = testPatientMPI.sampleSearch[0]!;
    const resultPatient: PatientMPI = testPatientMPI.sampleExclusions[0]!; // Choose a non-matching patient
    expect(matchingContactDetailsRule(searchPatient, resultPatient)).toBeFalsy();
  });
});
