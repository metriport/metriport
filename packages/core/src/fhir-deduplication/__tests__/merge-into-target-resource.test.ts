import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { makeCondition } from "../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { mergeIntoTargetResource } from "../shared";
import { icd10CodeMd, dateTime2, snomedCodeMd } from "./examples/condition-examples";

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

describe("mergeIntoTargetResource", () => {
  it("keeps the id of the first condition", () => {
    mergeIntoTargetResource(condition, condition2);
    expect(condition.id).toBe(conditionId);
  });

  it("keeps unique properties from both conditions", () => {
    condition.subject = { reference: "Patient/123" };
    condition2.recorder = { reference: "Some ref" };

    mergeIntoTargetResource(condition, condition2);
    expect(condition).toHaveProperty("recorder.reference", "Some ref");
    expect(condition).toHaveProperty("subject.reference", "Patient/123");
  });

  it("combines array properties", () => {
    if (!snomedCodeMd.code || !icd10CodeMd.code) {
      throw new Error("Test data is invalid - codes must be defined");
    }

    condition.code = { coding: [snomedCodeMd] };
    condition2.code = { coding: [icd10CodeMd] };

    mergeIntoTargetResource(condition, condition2);
    expect(condition.code).toEqual(
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

    mergeIntoTargetResource(condition, condition2);
    expect(condition.code?.coding?.length).toBe(1);
  });

  it("contains references to combined conditions inside the extension", () => {
    mergeIntoTargetResource(condition, condition2);
    expect(condition.extension).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueRelatedArtifact: expect.objectContaining({
            type: "derived-from",
            display: expect.stringContaining(conditionId2),
          }),
        }),
      ])
    );
  });

  it("does not combine extensions when it's disabled", () => {
    condition.extension = [
      {
        url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
        valueString: "some_cda_file.xml",
      },
    ];
    condition2.extension = [
      {
        url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
        valueString: "some_other_cda_file.xml",
      },
    ];
    mergeIntoTargetResource(condition, condition2, false);
    expect(condition.extension).toBe(undefined);
  });

  it("combines extensions when it's enabled", () => {
    condition.extension = [
      {
        url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
        valueString: "expect-this.xml",
      },
    ];
    condition2.extension = [
      {
        url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
        valueString: "do-not-include.xml",
      },
    ];
    mergeIntoTargetResource(condition, condition2);
    expect(condition.extension).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueString: "expect-this.xml",
        }),
      ])
    );
    expect(condition.extension).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueString: "do-not-include.xml",
        }),
      ])
    );
  });
});
