import { faker } from "@faker-js/faker";
import { mergeIntoTargetResource } from "../../../../../fhir-deduplication/shared";
import { makeCondition } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { filterOutPatientAndRemoveDerivedFromExtensions } from "../ingest-lexical";

describe("singest-lexical", () => {
  describe("filterOutPatientAndRemoveDerivedFromExtensions", () => {
    it(`returns original array when nothing to hydrate`, async () => {
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
});
