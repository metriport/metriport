import {
  jaroWinklerSimilarity,
  matchingPersonalIdentifiersRule,
  matchingContactDetailsRule,
} from "../match-patient";
import { PatientData } from "../../../../domain/medical/patient";
import { testPatientData } from "./test_data";

describe("normalizePatientData", () => {
  it("identifies sampleInclusions as matches", async () => {
    const searchPatient: PatientData = testPatientData.sampleSearch[0];
    testPatientData.sampleInclusions.forEach((resultData: PatientData) => {
      const resultPatient: PatientData = resultData;
      expect(jaroWinklerSimilarity(searchPatient, resultPatient, 0.96)).toBeTruthy();
    });
  });

  it("identifies sampleExclusions as non-matches", async () => {
    const searchPatient: PatientData = testPatientData.sampleSearch[0];
    testPatientData.sampleExclusions.forEach((resultData: PatientData) => {
      expect(jaroWinklerSimilarity(searchPatient, resultData, 0.96)).toBeFalsy();
    });
  });

  // suceeds for two patients with matching identifier details
  it("identifies matching personal identifiers", async () => {
    const searchPatient: PatientData = testPatientData.sampleSearch[0];
    const resultPatient: PatientData = testPatientData.sampleInclusions[0]; // Choose a matching patient
    expect(matchingPersonalIdentifiersRule(searchPatient, resultPatient)).toBeTruthy();
  });

  it("identifies non-matching personal identifiers", async () => {
    const searchPatient: PatientData = testPatientData.sampleSearch[0];
    const resultPatient: PatientData = testPatientData.sampleExclusions[0]; // Choose a non-matching patient
    expect(matchingPersonalIdentifiersRule(searchPatient, resultPatient)).toBeFalsy();
  });

  // fails for two patients without contact details
  it("identifies non existent contact details", async () => {
    const searchPatient: PatientData = testPatientData.sampleSearch[0];
    const resultPatient: PatientData = testPatientData.sampleInclusions[0];
    expect(matchingContactDetailsRule(searchPatient, resultPatient)).toBeFalsy();
  });

  it("identifies non-matching contact details", async () => {
    const searchPatient: PatientData = testPatientData.sampleSearch[0];
    const resultPatient: PatientData = testPatientData.sampleExclusions[0]; // Choose a non-matching patient
    expect(matchingContactDetailsRule(searchPatient, resultPatient)).toBeFalsy();
  });
});
