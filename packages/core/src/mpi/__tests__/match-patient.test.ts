import {
  jaroWinklerSimilarity,
  matchingPersonalIdentifiersRule,
  matchingContactDetailsRule,
  removeCommonPrefixesAndSuffixes,
  removeInitialsFromName,
} from "../match-patients";
import { PatientMPI } from "../shared";
import { testPatientMPI } from "./test_data";

/* eslint-disable @typescript-eslint/no-non-null-assertion */
describe("jaroWinklerSimilarity", () => {
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
});

describe("matchingPersonalIdentifiersRule", () => {
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
});

describe("matchingContactDetailsRule", () => {
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

  it("identifies non-matching contact details only phones", async () => {
    const searchPatient: PatientMPI = testPatientMPI.sampleSearch[1]!;
    const resultPatient: PatientMPI = testPatientMPI.sampleExclusions[1]!; // Choose a non-matching patient
    expect(matchingContactDetailsRule(searchPatient, resultPatient)).toBeFalsy();
  });

  it("identifies non-matching contact details only emails", async () => {
    const searchPatient: PatientMPI = testPatientMPI.sampleSearch[2]!;
    const resultPatient: PatientMPI = testPatientMPI.sampleExclusions[2]!; // Choose a non-matching patient
    expect(matchingContactDetailsRule(searchPatient, resultPatient)).toBeFalsy();
  });
});

describe("removeCommonPrefixesAndSuffixes", () => {
  it("should remove common prefixes", () => {
    expect(removeCommonPrefixesAndSuffixes("Mr John")).toBe("John");
    expect(removeCommonPrefixesAndSuffixes("Mrs Smith")).toBe("Smith");
    expect(removeCommonPrefixesAndSuffixes("Dr Jane")).toBe("Jane");
    expect(removeCommonPrefixesAndSuffixes("Prof Robert")).toBe("Robert");
  });

  it("should remove common suffixes", () => {
    expect(removeCommonPrefixesAndSuffixes("Smith Jr")).toBe("Smith");
    expect(removeCommonPrefixesAndSuffixes("Johnson Sr")).toBe("Johnson");
    expect(removeCommonPrefixesAndSuffixes("Williams III")).toBe("Williams");
    expect(removeCommonPrefixesAndSuffixes("Brown II")).toBe("Brown");
    expect(removeCommonPrefixesAndSuffixes("Wilson PhD")).toBe("Wilson");
    expect(removeCommonPrefixesAndSuffixes("Taylor MD")).toBe("Taylor");
    expect(removeCommonPrefixesAndSuffixes("Anderson Esq")).toBe("Anderson");
  });

  it("should handle both prefix and suffix", () => {
    expect(removeCommonPrefixesAndSuffixes("Mr Smith Jr")).toBe("Smith");
    expect(removeCommonPrefixesAndSuffixes("Dr Johnson MD")).toBe("Johnson");
    expect(removeCommonPrefixesAndSuffixes("Prof Wilson PhD")).toBe("Wilson");
  });

  it("should be case insensitive", () => {
    expect(removeCommonPrefixesAndSuffixes("mr Smith")).toBe("Smith");
    expect(removeCommonPrefixesAndSuffixes("Smith JR")).toBe("Smith");
    expect(removeCommonPrefixesAndSuffixes("DR Johnson md")).toBe("Johnson");
  });

  it("should handle names without prefixes or suffixes", () => {
    expect(removeCommonPrefixesAndSuffixes("John Smith")).toBe("John Smith");
    expect(removeCommonPrefixesAndSuffixes("Mary Johnson")).toBe("Mary Johnson");
  });

  it("should handle empty strings", () => {
    expect(removeCommonPrefixesAndSuffixes("")).toBe("");
  });

  it("should handle whitespace", () => {
    expect(removeCommonPrefixesAndSuffixes("  Mr   Smith  Jr  ")).toBe("Smith");
    expect(removeCommonPrefixesAndSuffixes("Dr    Jane   MD   ")).toBe("Jane");
    expect(removeCommonPrefixesAndSuffixes("Prof.    Robert   PhD.   ")).toBe("Robert");
  });

  it("should handle prefixes and suffixes with periods", () => {
    expect(removeCommonPrefixesAndSuffixes("Mr. Smith")).toBe("Smith");
    expect(removeCommonPrefixesAndSuffixes("Dr. Johnson")).toBe("Johnson");
    expect(removeCommonPrefixesAndSuffixes("Prof. Wilson")).toBe("Wilson");
    expect(removeCommonPrefixesAndSuffixes("Smith Jr.")).toBe("Smith");
    expect(removeCommonPrefixesAndSuffixes("Johnson Sr.")).toBe("Johnson");
    expect(removeCommonPrefixesAndSuffixes("Dr. Smith Jr.")).toBe("Smith");
  });
});

describe("removeInitialsFromName", () => {
  it("should remove single letters from names", () => {
    expect(removeInitialsFromName("John A Smith")).toBe("John Smith");
    expect(removeInitialsFromName("Mary J Doe")).toBe("Mary Doe");
    expect(removeInitialsFromName("Robert E Lee")).toBe("Robert Lee");
    expect(removeInitialsFromName("John F. Smith")).toBe("John Smith");
  });

  it("should preserve multi-letter parts", () => {
    expect(removeInitialsFromName("Ab C De")).toBe("Ab De");
    expect(removeInitialsFromName("John Jr Smith")).toBe("John Jr Smith");
  });

  it("should handle multiple single letters", () => {
    expect(removeInitialsFromName("A B C Smith")).toBe("Smith");
    expect(removeInitialsFromName("John A B C")).toBe("John");
  });

  it("should handle empty strings and single letters", () => {
    expect(removeInitialsFromName("")).toBe("");
    expect(removeInitialsFromName("A")).toBe("");
  });

  it("should handle names with extra spaces", () => {
    expect(removeInitialsFromName("John   A    Smith")).toBe("John Smith");
    expect(removeInitialsFromName("  A  B  Smith  ")).toBe("Smith");
  });
});
