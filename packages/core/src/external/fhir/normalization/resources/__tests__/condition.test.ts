import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { ICD_10_URL } from "@metriport/shared/medical";
import { HCC_EXTENSION_URL } from "../../../shared/extensions/hcc-extension";
import { normalizeConditions } from "../condition";

function makeCondition({ icd10Code }: { icd10Code: string }): Condition {
  return {
    resourceType: "Condition",
    id: faker.string.uuid(),
    code: { coding: [{ system: ICD_10_URL, code: icd10Code }] },
  };
}

describe("normalizeConditions", () => {
  it("should add HCC coding to a condition with an ICD-10 code", () => {
    const testCondition = makeCondition({ icd10Code: "A36.81" });

    const conditions = normalizeConditions([testCondition]);
    const result = conditions[0];
    expect(result).toBeDefined();
    if (!result) return;

    const extensions = result.extension;
    expect(extensions).toBeDefined();
    if (!extensions) return;

    const hccExtensions = extensions.filter(extension => extension.url === HCC_EXTENSION_URL);
    expect(hccExtensions.length).toBe(2);

    const versionToHccCode = Object.fromEntries(
      hccExtensions.map(extension => {
        const coding = extension.valueCodeableConcept?.coding?.[0];
        if (!coding) return [];
        return [coding.version, coding.code];
      })
    );
    expect(versionToHccCode).toEqual({ v24: "85", v28: "227" });
  });

  it("should not add HCC coding to a condition with a non-ICD-10 code", () => {
    const testCondition = makeCondition({ icd10Code: "invalid" });

    const conditions = normalizeConditions([testCondition]);
    const result = conditions[0];
    expect(result).toBeDefined();
    if (!result) return;
    expect(result.extension).toBeUndefined();
  });
});
