import { faker } from "@faker-js/faker";
import { makePatient } from "../../../../../external/fhir/__tests__/patient";
import { mergeIntoTargetResource } from "../../../../../fhir-deduplication/shared";
import { makeCondition } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { filterOutPatientAndRemoveDerivedFromExtensions } from "../ingest-lexical";

describe("singest-lexical", () => {
  describe("filterOutPatientAndRemoveDerivedFromExtensions", () => {
    it(`removes derived-from extensions from non-Patient resources`, async () => {
      const conditionId = faker.string.uuid();
      const conditionId2 = faker.string.uuid();
      const condition = makeCondition({ id: conditionId });
      const condition2 = makeCondition({ id: conditionId2 });
      mergeIntoTargetResource(condition, condition2);
      const originalExtensions = "extension" in condition ? condition.extension : [];
      expect(originalExtensions).toBeTruthy();
      expect(originalExtensions.length).toEqual(1);
      expect(originalExtensions[0]?.valueRelatedArtifact?.type).toEqual("derived-from");

      const res = filterOutPatientAndRemoveDerivedFromExtensions(condition);

      expect(res).toBeTruthy();
      if (!res) throw new Error("res is undefined");
      const extensions = "extension" in res ? res.extension : [];
      expect(extensions).toBeTruthy();
      expect(extensions.length).toEqual(0);
    });
  });

  it(`filters out Patient resources`, async () => {
    const patientResource = makePatient();
    const result = filterOutPatientAndRemoveDerivedFromExtensions(patientResource);
    expect(result).toBeUndefined();
  });

  it(`returns undefined for undefined input`, async () => {
    const result = filterOutPatientAndRemoveDerivedFromExtensions(undefined);
    expect(result).toBeUndefined();
  });
});
