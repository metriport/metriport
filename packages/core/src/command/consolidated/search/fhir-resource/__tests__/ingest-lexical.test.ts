import { faker } from "@faker-js/faker";
import { mergeIntoTargetResource } from "../../../../../fhir-deduplication/shared";
import { makeCondition } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { removeDerivedFromExtensions } from "../ingest-lexical";

describe("ingest-lexical", () => {
  describe("removeDerivedFromExtensions", () => {
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

      const res = removeDerivedFromExtensions(condition);

      expect(res).toBeTruthy();
      if (!res) throw new Error("res is undefined");
      const extensions = "extension" in res ? res.extension : [];
      expect(extensions).toBeTruthy();
      expect(extensions.length).toEqual(0);
    });

    it(`handles resources with empty extensions array`, async () => {
      const condition = makeCondition({ id: faker.string.uuid() });
      condition.extension = [];

      const res = removeDerivedFromExtensions(condition);

      expect(res).toBeTruthy();
      if (!res) throw new Error("res is undefined");
      const extensions = "extension" in res ? res.extension : [];
      expect(extensions).toBeTruthy();
      expect(extensions.length).toEqual(0);
    });

    it(`keeps non-derived-from extensions while removing derived-from ones`, async () => {
      const condition = makeCondition({ id: faker.string.uuid() });
      const condition2 = makeCondition({ id: faker.string.uuid() });
      mergeIntoTargetResource(condition, condition2);

      // Add a non-derived-from extension
      const nonDerivedFromExtension = {
        url: "http://example.com/custom-extension",
        valueString: "custom-value",
      };
      condition.extension = [...(condition.extension ?? []), nonDerivedFromExtension];

      const originalExtensions = "extension" in condition ? condition.extension : [];
      expect(originalExtensions).toBeTruthy();
      expect(originalExtensions.length).toEqual(2);

      const res = removeDerivedFromExtensions(condition);

      expect(res).toBeTruthy();
      if (!res) throw new Error("res is undefined");
      const extensions = "extension" in res ? res.extension : [];
      expect(extensions).toBeTruthy();
      expect(extensions.length).toEqual(1);
      expect(extensions[0]).toEqual(nonDerivedFromExtension);
    });
  });
});
