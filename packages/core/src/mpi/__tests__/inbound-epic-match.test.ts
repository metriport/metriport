import { USState } from "@metriport/shared";
import { epicMatchingAlgorithm } from "../match-patients";
import { PatientData } from "../../domain/patient";

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

  const differentPatient: PatientData = {
    firstName: "Jane",
    lastName: "Smith",
    dob: "1985-07-15",
    genderAtBirth: "F",
    address: [{ addressLine1: "456 Elm St", city: "Othertown", state: USState.NY, zip: "67890" }],
    contact: [{ phone: "9876543210", email: "jane.smith@example.com" }],
  };

  const partialAddress = [
    { addressLine1: "123 Test St", city: "Anytown", state: USState.CA, zip: "12345" },
  ];
  const partialDob = "1990-02-01";
  const emailContact = [{ email: "john.doe@example.com" }];
  const phoneContact = [{ phone: "1234567890" }];

  it("fail w/ default different", async () => {
    const patient1 = { ...basePatient };
    const patient2 = { ...differentPatient };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });

  it("pass w/ dob (8), name (10), exact address (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ dob (8), name (10), partial address (1) and gender (1)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: partialAddress,
      genderAtBirth: basePatient.genderAtBirth,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ dob (8), name (10), exact phone (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      contact: phoneContact,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ dob (8), name (10), exact email (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      contact: emailContact,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ dob (8), name (10), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ name (10), partial dob (2), exact address (2), exact phone (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: partialDob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: phoneContact,
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ name (10), partial dob (2), exact address (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: partialDob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: emailContact,
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ name (10), partial dob (2), exact phone (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: partialDob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: basePatient.contact ?? [],
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ dob (8), partial name (5), exact address (2), exact phone (2), exact email (2) and gender (1))", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: "Johnathan",
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: basePatient.contact ?? [],
      genderAtBirth: basePatient.genderAtBirth,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ dob (8), partial name (5), exact phone (2), exact email (2), gender (1), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: "Johnathan",
      lastName: basePatient.lastName,
      contact: basePatient.contact ?? [],
      genderAtBirth: basePatient.genderAtBirth,
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ name (10), exact address (2), exact phone (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: basePatient.contact ?? [],
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ name (10), partial address (1), gender (1), exact phone (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: partialAddress,
      genderAtBirth: basePatient.genderAtBirth,
      contact: basePatient.contact ?? [],
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });
  it("fail w/ dob (8), exact address (2), gender (1), exact phone (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      address: partialAddress,
      genderAtBirth: basePatient.genderAtBirth,
      contact: basePatient.contact ?? [],
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });
  it("fail w/ dob (8), name (10)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });
  it("fail w/ dob (8), name (10), gender (1)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      genderAtBirth: basePatient.genderAtBirth,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });
  it("fail w/ dob (8), name (10), partial address (1)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: partialAddress,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });
  it("fail w/ name (10), exact address (2), exact phone (2), exact email (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: basePatient.contact ?? [],
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });
  it("fail w/ name (10), exact address (2), exact phone (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: phoneContact,
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });
  it("fail w/ name (10), exact address (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: emailContact,
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });

  it("pass w/ comma-separated first names in patient2 (10), dob (8), exact address (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: "John,Johnny",
      lastName: basePatient.lastName,
      address: basePatient.address,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ comma-separated last names in patient2 (10), dob (8), exact address (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: "Doe,Smith",
      address: basePatient.address,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ comma-separated first and last names in patient2 (10), dob (8), exact address (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: "John,Johnny",
      lastName: "Doe,Smith",
      address: basePatient.address,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ partial match in comma-separated names in patient2 (5), dob (8), exact address (2), gender (1), exact phone (2), exact email (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: "Johnny,Jane",
      lastName: "Doe,Johnson",
      address: basePatient.address,
      genderAtBirth: basePatient.genderAtBirth,
      contact: basePatient.contact ?? [],
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("fail w/ no match in comma-separated names in patient2, dob (8), exact address (2)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: "Jane,Janet",
      lastName: "Smith,Johnson",
      address: basePatient.address,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });

  it("fail w/ requirePartialNameMatch and no name matches, dob (8), exact address (2), exact phone (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: "Jane",
      lastName: "Smith",
      address: basePatient.address,
      contact: basePatient.contact ?? [],
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(false);
  });

  it("pass w/ requirePartialNameMatch and first name matches (5), dob (8), exact address (2), exact phone (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: "Smith",
      address: basePatient.address,
      contact: basePatient.contact ?? [],
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ requirePartialNameMatch and last name matches (5), dob (8), exact address (2), exact phone (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: "Jane",
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: basePatient.contact ?? [],
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });

  it("pass w/ requirePartialNameMatch and both names match (10), dob (8), exact address (2), exact phone (2), exact email (2), exact ssn (5)", () => {
    const patient1 = { ...basePatient };
    const patient2 = {
      ...differentPatient,
      dob: basePatient.dob,
      firstName: basePatient.firstName,
      lastName: basePatient.lastName,
      address: basePatient.address,
      contact: basePatient.contact ?? [],
      personalIdentifiers: basePatient.personalIdentifiers,
    };
    expect(epicMatchingAlgorithm(patient1, patient2, 20)).toBe(true);
  });
});
