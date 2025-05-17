import { faker } from "@faker-js/faker";
import { CodeableConcept } from "@medplum/fhirtypes";
import {
  CPT_CODE,
  CVX_CODE,
  ICD_10_CODE,
  ICD_9_CODE,
  LOINC_CODE,
  NDC_CODE,
  RXNORM_CODE,
  SNOMED_CODE,
} from "../../../../../../util/constants";
import { formatCodeableConcept } from "../codeable-concept";

describe("codeable-concept", () => {
  describe("formatCodeableConcept", () => {
    it("returns empty string if no concept", () => {
      const concept: CodeableConcept = { coding: [] };
      const res = formatCodeableConcept(concept);
      expect(res).toBeUndefined();
    });

    it("returns empty string if only system", () => {
      const concept: CodeableConcept = {
        coding: [{ system: getSystem() }, { system: faker.lorem.word() }],
      };
      const res = formatCodeableConcept(concept);
      expect(res).toBeUndefined();
    });

    it("returns code and display when present", () => {
      const [code, display] = makeCodeAndDisplay();
      const concept: CodeableConcept = {
        coding: [{ system: SNOMED_CODE, code, display }],
      };
      const formatted = formatCodeableConcept(concept);
      expect(formatted).toEqual(`${code} (${display})`);
    });

    it("returns code and display when no system is present", () => {
      const [code, display] = makeCodeAndDisplay();
      const concept: CodeableConcept = {
        coding: [{ code, display }],
      };
      const formatted = formatCodeableConcept(concept);
      expect(formatted).toEqual(`${code} (${display})`);
    });

    it("accepts any system", () => {
      const [code, display] = makeCodeAndDisplay();
      const concept: CodeableConcept = {
        coding: [{ system: faker.lorem.word(), code, display }],
      };
      const formatted = formatCodeableConcept(concept);
      expect(formatted).toEqual(`${code} (${display})`);
    });

    it("returns concatenated code and display when multiple codes and displays present", () => {
      const [code1, display1] = makeCodeAndDisplay();
      const [code2, display2] = makeCodeAndDisplay();
      const concept: CodeableConcept = {
        coding: [
          { system: getSystem(), code: code1, display: display1 },
          { code: code2, display: display2 },
        ],
      };
      const formatted = formatCodeableConcept(concept);
      const codeDisplay1 = `${code1} (${display1})`;
      const codeDisplay2 = `${code2} (${display2})`;
      const expected = [codeDisplay1, codeDisplay2].sort().join(" / ");
      expect(formatted).toEqual(expected);
    });

    it("returns text with remaining data", () => {
      const [code1, display1] = makeCodeAndDisplay();
      const [code2, display2] = makeCodeAndDisplay();
      const text = faker.lorem.sentence();
      const concept: CodeableConcept = {
        text,
        coding: [
          { system: getSystem(), code: code1, display: display1 },
          { system: getSystem(), code: code2, display: display2 },
        ],
      };
      const formatted = formatCodeableConcept(concept);
      const codeDisplay1 = `${code1} (${display1})`;
      const codeDisplay2 = `${code2} (${display2})`;
      const expected = [codeDisplay1, codeDisplay2].sort().join(" / ");
      expect(formatted).toEqual(`${text}: ${expected}`);
    });

    it("returns text when no remaining data", () => {
      const text = faker.lorem.sentence();
      const concept: CodeableConcept = {
        text,
        coding: [],
      };
      const formatted = formatCodeableConcept(concept);
      expect(formatted).toEqual(`${text}`);
    });
  });
});

const allowedSystems = [
  RXNORM_CODE,
  NDC_CODE,
  CPT_CODE,
  CVX_CODE,
  ICD_10_CODE,
  ICD_9_CODE,
  LOINC_CODE,
  SNOMED_CODE,
];

function getSystem() {
  return faker.helpers.arrayElement(allowedSystems);
}

function makeCodeAndDisplay(): [string, string] {
  const code = faker.number.hex({ min: 100000, max: 0xffffff }).toString();
  const display = faker.lorem.word();
  return [code, display];
}
