import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { makeCondition } from "../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { combineTwoConditions } from "../deduplicate-fhir";
import { icd10CodeMd, onsetPeriod2, snomedCodeMd } from "./condition-examples";

let conditionId: string;
let conditionId2: string;
let condition: Condition;
let condition2: Condition;

beforeAll(() => {
  conditionId = faker.string.uuid();
  conditionId2 = faker.string.uuid();
  condition = makeCondition({ id: conditionId });
  condition2 = makeCondition({ id: conditionId2, onsetPeriod: onsetPeriod2 });
});

describe("groupSameConditions", () => {
  it("keeps the id of the first condition", () => {
    const combinedCondition = combineTwoConditions(condition, condition2);
    expect(combinedCondition.id).toBe(conditionId);
  });

  it("keeps unique properties from both conditions", () => {
    condition.subject = { reference: "Patient/123" };
    condition2.recorder = { reference: "Some ref" };

    const combinedCondition = combineTwoConditions(condition, condition2);
    expect(combinedCondition).toHaveProperty("recorder.reference", "Some ref");
    expect(combinedCondition).toHaveProperty("subject.reference", "Patient/123");
  });

  it("combines array properties", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [icd10CodeMd] };

    const combinedCondition = combineTwoConditions(condition, condition2);
    expect(combinedCondition.code).toEqual(
      expect.objectContaining({
        coding: expect.arrayContaining([
          expect.objectContaining({
            code: expect.stringContaining(snomedCodeMd.code),
          }),
          expect.objectContaining({
            code: expect.stringContaining(icd10CodeMd.code),
          }),
        ]),
      })
    );
  });

  it("does not duplicate array entries", () => {
    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [snomedCodeMd] };

    const combinedCondition = combineTwoConditions(condition, condition2);
    expect(combinedCondition.code?.coding?.length).toBe(1);
  });

  it("contains references to combined conditions inside the extension", () => {
    const combinedCondition = combineTwoConditions(condition, condition2);
    expect(combinedCondition.extension).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueReference: expect.objectContaining({
            reference: expect.stringContaining(conditionId2),
          }),
        }),
      ])
    );
  });
});
