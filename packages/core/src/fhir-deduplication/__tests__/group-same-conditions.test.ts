import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { makeCondition } from "../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { groupSameConditions } from "../resources/condition";
import {
  dateTime,
  dateTime2,
  icd10CodeAo,
  icd10CodeMd,
  otherCodeSystemMd,
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
  condition2 = makeCondition({ id: conditionId2 });
});

describe("groupSameConditions", () => {
  it("correctly groups duplicate conditions based on snomed codes", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [snomedCodeMd] };

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(1);
  });

  it("correctly groups duplicate conditions based on snomed codes and dates", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [snomedCodeMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(1);
  });

  it("correctly groups duplicate conditions based on snomed codes, even if one condition is missing the date", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [snomedCodeMd] };
    condition2.onsetPeriod = dateTime;

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(1);
  });

  it("does not group conditions with the same snomed codes, but different dates", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [snomedCodeMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime2;

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(2);
  });

  it("correctly groups duplicate conditions based on icd10 codes", () => {
    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [icd10CodeMd] };

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(1);
  });

  it("correctly groups duplicate conditions based on the same name despite different systems", () => {
    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [otherCodeSystemMd] };

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(1);
  });

  it("correctly groups duplicate conditions based on overlapping codes from different systems", () => {
    condition.code = { coding: [snomedCodeMd, icd10CodeMd, otherCodeSystemMd] };
    condition2.code = { coding: [snomedCodeMd] };
    const condition3 = makeCondition({ id: faker.string.uuid(), code: { coding: [icd10CodeMd] } });
    const condition4 = makeCondition({
      id: faker.string.uuid(),
      code: { coding: [otherCodeSystemMd] },
    });

    const { conditionsMap } = groupSameConditions(
      [condition, condition2, condition3, condition4],
      true
    );
    expect(conditionsMap.size).toBe(1);
  });

  it("does not group conditions with different codes", () => {
    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [icd10CodeAo] };

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(2);
  });

  it("does not group conditions with different names", () => {
    if (
      !icd10CodeMd.display ||
      !icd10CodeMd.system ||
      !icd10CodeAo.display ||
      !icd10CodeAo.system
    ) {
      throw new Error("Test data is invalid - display and system must be defined");
    }

    condition.code = { coding: [{ display: icd10CodeMd.display, system: icd10CodeMd.system }] };
    condition2.code = { coding: [{ display: icd10CodeAo.display, system: icd10CodeAo.system }] };

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(2);
  });

  it("does not group conditions with different names", () => {
    if (
      !icd10CodeMd.display ||
      !icd10CodeMd.system ||
      !icd10CodeAo.display ||
      !icd10CodeAo.system
    ) {
      throw new Error("Test data is invalid - display must be defined");
    }

    condition.code = { coding: [{ display: icd10CodeMd.display, system: icd10CodeMd.system }] };
    condition2.code = { coding: [{ display: icd10CodeAo.display, system: icd10CodeAo.system }] };

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(2);
  });

  it("does not group conditions with different codes despite the same date", () => {
    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [snomedCodeMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(2);
  });

  it("removes conditions that have neither snomed, nor icd-10 codes, nor display", () => {
    condition.code = { coding: [{ system: "some other system", code: "123" }] };
    condition.onsetPeriod = dateTime;

    const { conditionsMap } = groupSameConditions([condition], true);
    expect(conditionsMap.size).toBe(0);
  });

  it("removes conditions that only have one coding that just says 'Problem'", () => {
    condition.code = {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "55607006",
          display: "Problem",
        },
      ],
    };
    condition.onsetPeriod = dateTime;

    const { conditionsMap } = groupSameConditions([condition], true);
    expect(conditionsMap.size).toBe(0);
  });

  it("keeps the conditions that only have more than one coding, where one just says 'Problem'", () => {
    condition.code = {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "55607006",
          display: "Problem",
        },
        snomedCodeMd,
      ],
    };
    condition.onsetPeriod = dateTime;

    const { conditionsMap } = groupSameConditions([condition], true);
    expect(conditionsMap.size).toBe(1);
  });

  it("strips away codes that aren't SNOMED or ICD-10", () => {
    if (!snomedCodeMd.system || !icd10CodeMd.system || !otherCodeSystemMd.system) {
      throw new Error("Test data is invalid - system must be defined");
    }

    condition.code = { coding: [icd10CodeMd] };
    condition2.code = { coding: [icd10CodeMd, snomedCodeMd, otherCodeSystemMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;
    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(1);

    const resultingCoding = conditionsMap.values().next().value.code.coding;

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

  it("do not remove code and preserve original coding when there is only one code of unrecognized system - without dates included", () => {
    condition.code = { coding: [otherCodeSystemMd] };
    condition2.code = { coding: [otherCodeSystemMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(1);
    const groupedCondition = conditionsMap.values().next().value;
    expect(groupedCondition.code?.coding).toEqual([otherCodeSystemMd]);
  });

  it("do not remove code and preserve original coding when there is only one code of unrecognized system - with dates included", () => {
    condition.code = { coding: [otherCodeSystemMd] };
    condition2.code = { coding: [otherCodeSystemMd] };
    condition.onsetPeriod = dateTime;
    condition2.onsetPeriod = dateTime;

    const { conditionsMap } = groupSameConditions([condition, condition2], true);
    expect(conditionsMap.size).toBe(1);
    const groupedCondition = conditionsMap.values().next().value;
    expect(groupedCondition.code?.coding).toEqual([otherCodeSystemMd]);
  });
});
