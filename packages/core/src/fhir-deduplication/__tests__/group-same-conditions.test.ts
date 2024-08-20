import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { makeCondition } from "../../fhir-to-cda/cda-templates/components/__tests__/make-condition";

import { groupSameConditions } from "../resources/condition";
import {
  icd10CodeAo,
  icd10CodeMd,
  dateTime,
  dateTime2,
  otherCodeSystemMd,
  snomedCodeAo,
  snomedCodeMd,
} from "./examples/condition-examples";

let conditionId: string;
let conditionId2: string;
let condition: Condition;
let condition2: Condition;

beforeEach(() => {
  conditionId = faker.string.uuid();
  conditionId2 = faker.string.uuid();
  condition = makeCondition({ id: conditionId });
  condition2 = makeCondition({ id: conditionId2, onsetPeriod: dateTime2 });
});

describe("groupSameConditions", () => {
  it("correctly groups duplicate conditions based on snomed codes", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [snomedCodeMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { snomedMap } = groupSameConditions([condition, condition2]);
    expect(snomedMap.size).toBe(1);
  });

  it("correctly groups duplicate conditions based on icd10 codes", () => {
    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [icd10CodeMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { icd10Map } = groupSameConditions([condition, condition2]);
    expect(icd10Map.size).toBe(1);
  });

  it("does not group duplicate conditions that don't have overlapping codes", () => {
    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [snomedCodeMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { icd10Map, snomedMap } = groupSameConditions([condition, condition2]);
    expect(icd10Map.size).toBe(1);
    expect(snomedMap.size).toBe(1);
  });

  it("loses conditions that have neither snomed nor icd-10 codes", () => {
    condition.code = { coding: [{ system: "some other system", code: "123" }] };
    condition.onsetPeriod = dateTime;

    const { icd10Map, snomedMap } = groupSameConditions([condition]);
    expect(icd10Map.size).toBe(0);
    expect(snomedMap.size).toBe(0);
  });

  it("does not group conditions with different snomed codes", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [snomedCodeAo] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { snomedMap } = groupSameConditions([condition, condition2]);
    expect(snomedMap.size).toBe(2);
  });

  it("does not group conditions with different icd10 codes", () => {
    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [icd10CodeAo] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { icd10Map } = groupSameConditions([condition, condition2]);
    expect(icd10Map.size).toBe(2);
  });

  it("does not group conditions with different onset dates", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [snomedCodeMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime2;

    const { snomedMap } = groupSameConditions([condition, condition2]);
    expect(snomedMap.size).toBe(2);
  });

  it("correctly removes codes that aren't SNOMED or ICD-10", () => {
    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [icd10CodeMd, snomedCodeMd, otherCodeSystemMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { icd10Map } = groupSameConditions([condition, condition2]);
    expect(icd10Map.size).toBe(1);
    const resultingCoding = icd10Map.values().next().value.code.coding;

    expect(resultingCoding.length).toEqual(2);
    expect(resultingCoding).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          system: expect.stringContaining(snomedCodeMd.system),
        }),
        expect.objectContaining({
          system: expect.stringContaining(icd10CodeMd.system),
        }),
      ])
    );

    expect(resultingCoding).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          system: expect.stringContaining(otherCodeSystemMd.system),
        }),
      ])
    );
  });
});
