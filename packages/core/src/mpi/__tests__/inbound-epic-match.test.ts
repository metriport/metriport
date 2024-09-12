import { USState } from "@metriport/shared";
import { epicMatchingAlgorithm } from "../match-patients";
import { PatientData, GenderAtBirth } from "../../domain/patient";

describe("epicMatchingAlgorithm", () => {
  const basePatient: PatientData = {
    firstName: "John",
    lastName: "Doe",
    dob: "1990-01-01",
    genderAtBirth: "M",
    address: [{ addressLine1: "123 Main St", city: "Anytown", state: USState.CA, zip: "12345" }],
    contact: [{ phone: "1234567890", email: "john.doe@example.com" }],
    personalIdentifiers: [{ type: "ssn", value: "123-45-6789" }],
  };

  it("should match identical patients", () => {
    const patient1 = { ...basePatient };
    const patient2 = { ...basePatient };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("should match patients with slight name and dob difference", () => {
    const patient1 = { ...basePatient };
    const patient2 = { ...basePatient, dob: "1995-01-01" };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("should not match patients with different names and dob", () => {
    const patient1 = { ...basePatient };
    const patient2 = { ...basePatient, lastName: "Smith", dob: "1995-01-01" };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });

  it("should not match patients with matching SSN when all other fields differ", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...basePatient,
      firstName: "Jane",
      lastName: "Smith",
      dob: "1995-01-01",
      genderAtBirth: "F" as GenderAtBirth,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });

  it("should match patient with different SSN if other fields are identical", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...basePatient,
      personalIdentifiers: [{ type: "ssn" as const, value: "987-65-4320" }],
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("should match patients with partial DOB match", () => {
    const patient1 = { ...basePatient };
    const patient2 = { ...basePatient, dob: "1990-01-02" };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("should not match patients with different names and DOB", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...basePatient,
      firstName: "Jane",
      lastName: "Smith",
      dob: "1995-01-01",
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });
});
