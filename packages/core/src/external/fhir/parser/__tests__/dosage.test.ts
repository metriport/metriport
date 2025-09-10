import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";
import { parseDosage } from "../dosage";

describe("dosage parsing tests", () => {
  it("should parse standard dosages", () => {
    const dosage = parseDosage("150 mg");
    expect(dosage).toEqual({
      doseQuantity: { value: 150, unit: "mg", system: UNIT_OF_MEASURE_URL, code: "mg" },
    });
  });

  it("should parse dosages with numeric words", () => {
    const dosage = parseDosage("eight units");
    expect(dosage).toEqual({
      doseQuantity: { value: 8, unit: "U", system: UNIT_OF_MEASURE_URL, code: "U" },
    });
  });

  it("should parse dosage with simple rate ratio", () => {
    const dosage = parseDosage("10 mg/mL");
    expect(dosage).toEqual({
      doseQuantity: { value: 10, unit: "mg", system: UNIT_OF_MEASURE_URL, code: "mg" },
      rateQuantity: { value: 1, unit: "mL", system: UNIT_OF_MEASURE_URL, code: "mL" },
    });
  });

  it("should parse dosage with numerator and denominator rate ratio", () => {
    const dosage = parseDosage("12 mmol/3 L");
    expect(dosage).toEqual({
      doseQuantity: { value: 12, unit: "mmol", system: UNIT_OF_MEASURE_URL, code: "mmol" },
      rateQuantity: { value: 3, unit: "L", system: UNIT_OF_MEASURE_URL, code: "L" },
    });
  });
});
