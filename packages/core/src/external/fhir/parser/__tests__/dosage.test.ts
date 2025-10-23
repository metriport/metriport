import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";
import { parseDosage } from "../dosage";
import { buildParserExtension } from "../extension";

describe("dosage parsing tests", () => {
  it("should parse standard dosages", () => {
    const inputString = "150 mg";
    const dosage = parseDosage(inputString);
    expect(dosage).toEqual({
      doseQuantity: { value: 150, unit: "mg", system: UNIT_OF_MEASURE_URL, code: "mg" },
      extension: [buildParserExtension(inputString)],
    });
  });

  it("should parse dosages with numeric words", () => {
    const inputString = "eight units";
    const dosage = parseDosage(inputString);
    expect(dosage).toEqual({
      doseQuantity: { value: 8, unit: "U", system: UNIT_OF_MEASURE_URL, code: "U" },
      extension: [buildParserExtension(inputString)],
    });
  });

  it("should parse dosage with simple rate ratio", () => {
    const inputString = "10 mg/mL";
    const dosage = parseDosage(inputString);
    expect(dosage).toEqual({
      doseQuantity: { value: 10, unit: "mg", system: UNIT_OF_MEASURE_URL, code: "mg" },
      rateQuantity: { value: 1, unit: "mL", system: UNIT_OF_MEASURE_URL, code: "mL" },
      extension: [buildParserExtension(inputString)],
    });
  });

  it("should parse dosage with numerator and denominator rate ratio", () => {
    const inputString = "12 mmol/3 L";
    const dosage = parseDosage(inputString);
    expect(dosage).toEqual({
      doseQuantity: { value: 12, unit: "mmol", system: UNIT_OF_MEASURE_URL, code: "mmol" },
      rateQuantity: { value: 3, unit: "L", system: UNIT_OF_MEASURE_URL, code: "L" },
      extension: [buildParserExtension(inputString)],
    });
  });
});
