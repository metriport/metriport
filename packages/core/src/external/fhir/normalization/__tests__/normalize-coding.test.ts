import { CodeableConcept } from "@medplum/fhirtypes";
import { CPT_URL, ICD_10_URL, LOINC_URL, RXNORM_URL, SNOMED_URL } from "../../../../util/constants";
import { unknownCoding } from "../../coding";
import { normalizeCodeableConcept, normalizeCoding } from "../coding";

describe("normalizeCodeableConcept", () => {
  it("should return concept unchanged when no coding array present", () => {
    const concept: CodeableConcept = {
      text: "Some text",
    };
    expect(normalizeCodeableConcept(concept)).toEqual(concept);
  });

  it("should sort codings based on system priority", () => {
    const concept: CodeableConcept = {
      coding: [
        { system: SNOMED_URL, code: "12345678", display: "Snomed Term" },
        { system: RXNORM_URL, code: "456", display: "Rxnorm Term" },
        { system: LOINC_URL, code: "56789-0", display: "Loinc Term" },
      ],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.coding).toBeDefined();
    expect(normalized.coding?.length).toEqual(3);

    expect(normalized.coding?.[0]).toBeDefined();
    expect(normalized.coding?.[0]?.system).toBe(RXNORM_URL);
    expect(normalized.coding?.[1]).toBeDefined();
    expect(normalized.coding?.[1]?.system).toBe(LOINC_URL);
    expect(normalized.coding?.[2]).toBeDefined();
    expect(normalized.coding?.[2]?.system).toBe(SNOMED_URL);
  });

  it("should set text to highest priority coding display if no text exists", () => {
    const concept: CodeableConcept = {
      coding: [
        { system: SNOMED_URL, code: "123", display: "Snomed Term" },
        { system: CPT_URL, code: "456", display: "Cpt Term" },
      ],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.text).toBe("Cpt Term");
  });

  it("should remove the coding from a known system if its code is UNK", () => {
    const concept: CodeableConcept = {
      coding: [
        { system: SNOMED_URL, code: "12345678", display: "Snomed Term" },
        { system: CPT_URL, code: "UNK" },
      ],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.coding?.length).toEqual(1);
    expect(normalized.text).toBe("Snomed Term");
  });

  it("should not set text if highest priority coding has no display", () => {
    const concept: CodeableConcept = {
      coding: [
        { system: SNOMED_URL, code: "123", display: "Snomed Term" },
        { system: CPT_URL, code: "456" },
      ],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.text).toEqual("Snomed Term");
  });

  it("should filter out invalid codings when multiple codings exist", () => {
    const concept: CodeableConcept = {
      coding: [
        { system: SNOMED_URL, code: "12345678", display: "Snomed Term" },
        { system: ICD_10_URL },
        { system: CPT_URL, code: "456", display: "Cpt Term" },
      ],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.coding).toHaveLength(2);
    expect(normalized.coding?.map(c => c.system)).toEqual([CPT_URL, SNOMED_URL]);
  });

  it("should not filter codings when only one coding exists", () => {
    const concept: CodeableConcept = {
      coding: [{ system: ICD_10_URL }],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.coding).toHaveLength(1);
    expect(normalized.coding?.[0]?.system).toBeDefined();
    expect(normalized.coding?.[0]?.system as string).toBe(ICD_10_URL);
  });

  it("Picks the first useful display to replace the text field", () => {
    const concept: CodeableConcept = {
      coding: [
        { system: CPT_URL, code: "456", display: "Unknown" },
        { system: SNOMED_URL, code: "12345678", display: "Snomed Term" },
      ],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.text).toEqual("Snomed Term");
  });

  it("Keeps the existing text if there's nothing better to replace it with", () => {
    const concept: CodeableConcept = {
      text: "Something intelligent",
      coding: [{ system: CPT_URL, code: "456", display: "Unknown" }],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.text).toEqual("Something intelligent");
  });

  it("Keeps the existing text if there's nothing better to replace it with", () => {
    const concept: CodeableConcept = {
      text: "Something intelligent",
      coding: [{ system: CPT_URL, code: "456", display: "Something more intelligent" }],
    };

    const normalized = normalizeCodeableConcept(concept);
    expect(normalized.text).toEqual("Something more intelligent");
  });
});

describe("normalizeCoding", () => {
  it("should return coding unchanged when no system is present", () => {
    const coding = { display: "Some display", code: "123" };
    expect(normalizeCoding(coding)).toEqual(coding);
  });

  it("should return coding unchanged when code is missing", () => {
    const coding = { system: SNOMED_URL, display: "Some display" };
    expect(normalizeCoding(coding)).toEqual(coding);
  });

  it("should return coding unchanged when code is empty string", () => {
    const coding = { system: SNOMED_URL, code: "", display: "Some display" };
    expect(normalizeCoding(coding)).toEqual(coding);
  });

  it("should validate SNOMED code and convert to LOINC if it matches LOINC pattern", () => {
    const coding = {
      system: SNOMED_URL,
      code: "12345-6",
      display: "Test code",
    };
    const normalized = normalizeCoding(coding);
    expect(normalized.system).toBe(LOINC_URL);
    expect(normalized.code).toBe("12345-6");
    expect(normalized.display).toBe("Test code");
  });

  it("should convert to unknown coding for invalid SNOMED code that doesn't match LOINC", () => {
    const coding = {
      system: SNOMED_URL,
      code: "invalid-code",
      display: "Test code",
    };
    const normalized = normalizeCoding(coding);
    expect(normalized).toEqual({
      ...unknownCoding,
      display: "Test code",
    });
  });

  it("should keep valid SNOMED code unchanged", () => {
    const coding = {
      system: SNOMED_URL,
      code: "123456789",
      display: "Test code",
    };
    const normalized = normalizeCoding(coding);
    expect(normalized.system).toBe(SNOMED_URL);
    expect(normalized.code).toBe("123456789");
    expect(normalized.display).toBe("Test code");
  });

  it("should convert to unknown coding for invalid LOINC code", () => {
    const coding = {
      system: LOINC_URL,
      code: "invalid-loinc",
      display: "Test code",
    };
    const normalized = normalizeCoding(coding);
    expect(normalized).toEqual({
      ...unknownCoding,
      display: "Test code",
    });
  });

  it("should keep valid LOINC code unchanged", () => {
    const coding = {
      system: LOINC_URL,
      code: "12345-6",
      display: "Test code",
    };
    const normalized = normalizeCoding(coding);
    expect(normalized.system).toBe(LOINC_URL);
    expect(normalized.code).toBe("12345-6");
    expect(normalized.display).toBe("Test code");
  });

  it("should use default unknown display when no display provided", () => {
    const coding = {
      system: LOINC_URL,
      code: "invalid-code",
    };
    const normalized = normalizeCoding(coding);
    expect(normalized).toEqual(unknownCoding);
  });
});
