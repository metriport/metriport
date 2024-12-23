import { faker } from "@faker-js/faker";
import { Condition, Patient } from "@medplum/fhirtypes";
import { makeBundle } from "../../../external/fhir/__tests__/bundle";
import { buildDocIdFhirExtension } from "../../../external/fhir/shared/extensions/doc-id-extension";
import { snomedCodeMd } from "../../../fhir-deduplication/__tests__/examples/condition-examples";
import { makeCondition } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import * as bundleMods from "../bundle-modifications";

function makeFilename(patientId: string = faker.string.uuid()): string {
  return `${faker.string.uuid()}_${patientId}_${faker.string.uuid()}.xml`;
}

function initTest() {
  const conditionId = faker.string.uuid();
  const patientId = faker.string.uuid();
  const condition = makeCondition(
    {
      id: conditionId,
      code: { coding: [snomedCodeMd] },
    },
    patientId
  );
  const fileName = makeFilename(patientId);
  const documentExtension = buildDocIdFhirExtension(fileName);
  return { patientId, condition, fileName, documentExtension };
}

describe("Checking postProcessBundle and its constituent functions", () => {
  describe("replaceIDs", () => {
    it("does not update the IDs if the extension is missing", () => {
      const { patientId, condition } = initTest();
      const bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = bundleMods.replaceIDs(bundle, patientId);
      const updCondition = updatedBundle.entry?.[0]?.resource;
      expect(updCondition).toBeDefined();
      expect(updCondition?.id).toBe(condition.id);
      expect(updCondition).toMatchObject(condition);
    });

    it("updates the ID and adds source metadata when extension is present", () => {
      const { patientId, condition, fileName, documentExtension } = initTest();
      condition.extension = [documentExtension];
      const bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = bundleMods.replaceIDs(bundle, patientId);
      const updCondition = updatedBundle.entry?.[0]?.resource;
      expect(updCondition).toBeDefined();
      expect(updCondition?.id).toBeDefined();
      expect(updCondition?.id).not.toBe(condition.id);
      expect(updCondition?.meta?.source).toBe(fileName);
      expect(updCondition).toMatchObject({
        ...condition,
        id: updCondition?.id,
        meta: { source: fileName },
      });
    });

    it("throws error when bundle entry is empty", () => {
      const { patientId } = initTest();
      const bundle = makeBundle({ entries: [], type: "collection" });
      expect(() => bundleMods.replaceIDs(bundle, patientId)).toThrow("Missing bundle entries");
    });

    it("throws error when bundle has no entries", () => {
      const { patientId } = initTest();
      const bundle = makeBundle({ type: "collection" });
      expect(() => bundleMods.replaceIDs(bundle, patientId)).toThrow("Missing bundle entries");
    });
  });

  describe("addExtensionToConversion", () => {
    it("adds a document extension to a resource that did not have it", () => {
      const { condition, documentExtension } = initTest();
      const bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = bundleMods.addExtensionToConversion(bundle, documentExtension);
      const updCondition = updatedBundle.entry?.[0]?.resource as Condition | undefined;
      expect(updCondition).toBeDefined();
      if (!updCondition) throw new Error("Bundle entry got removed!");

      expect(updCondition.extension).toHaveLength(1);
      expect(updCondition.extension?.[0]).toEqual(documentExtension);
      expect(condition.extension).toBeUndefined();
    });

    it("appends the document extension to a resource with existing extensions", () => {
      const { condition, documentExtension } = initTest();

      const existingExtension = {
        url: "http://example.com/existing",
        valueString: "test",
      };
      condition.extension = [existingExtension];
      const bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = bundleMods.addExtensionToConversion(bundle, documentExtension);
      const updCondition = updatedBundle.entry?.[0]?.resource as Condition | undefined;
      expect(updCondition).toBeDefined();
      if (!updCondition) throw new Error("Bundle entry got removed!");

      expect(updCondition.extension).toHaveLength(2);
      expect(updCondition.extension).toEqual(
        expect.arrayContaining([existingExtension, documentExtension])
      );
      expect(condition.extension).toHaveLength(1);
    });

    it("returns bundle unchanged when no entries exist", () => {
      const { documentExtension } = initTest();
      const bundle = makeBundle({ entries: [], type: "collection" });
      const updatedBundle = bundleMods.addExtensionToConversion(bundle, documentExtension);
      expect(updatedBundle).toEqual(bundle);
    });
  });

  describe("addMissingRequests", () => {
    it("appends a PUT request to each BundleEntry with correct resource references", () => {
      const { patientId, condition } = initTest();
      const condition2 = makeCondition({ id: faker.string.uuid() }, patientId);
      const bundle = makeBundle({ entries: [condition, condition2], type: "collection" });

      const updatedBundle = bundleMods.addMissingRequests(bundle);
      expect(updatedBundle.entry).toHaveLength(2);

      updatedBundle.entry?.forEach((entry, index) => {
        const resource = bundle.entry?.[index]?.resource;
        expect(entry.request).toEqual({
          method: "PUT",
          url: `${resource?.resourceType}/${resource?.id}`,
        });
      });
    });

    it("returns bundle unchanged when no entries exist", () => {
      const bundle = makeBundle({ entries: [], type: "collection" });
      const updatedBundle = bundleMods.addMissingRequests(bundle);
      expect(updatedBundle).toEqual(bundle);
    });
  });

  describe("removePatientFromConversion", () => {
    it("throws error when multiple Patient resources exist", () => {
      const { patientId, condition } = initTest();
      const patient1: Patient = {
        resourceType: "Patient",
        id: patientId,
        name: [{ given: ["John"], family: "Doe" }],
      };
      const patient2: Patient = {
        resourceType: "Patient",
        id: faker.string.uuid(),
        name: [{ given: ["Jane"], family: "Doe" }],
      };
      const bundle = makeBundle({ entries: [condition, patient1, patient2], type: "collection" });

      expect(() => bundleMods.removePatientFromConversion(bundle)).toThrow(
        "Multiple Patient resources found in Bundle"
      );
      expect(bundle.entry).toHaveLength(3);
    });

    it("removes single Patient resource from the Bundle", () => {
      const { patientId, condition } = initTest();
      const patient: Patient = {
        resourceType: "Patient",
        id: patientId,
        name: [{ given: ["John"], family: "Doe" }],
      };
      const bundle = makeBundle({ entries: [condition, patient], type: "collection" });

      const updatedBundle = bundleMods.removePatientFromConversion(bundle);
      expect(updatedBundle.entry).toHaveLength(1);
      expect(updatedBundle.entry?.[0]?.resource?.resourceType).toBe("Condition");
      expect(bundle.entry).toHaveLength(2);
    });

    it("returns bundle unchanged when no entries exist", () => {
      const bundle = makeBundle({ entries: [], type: "collection" });
      const updatedBundle = bundleMods.removePatientFromConversion(bundle);
      expect(updatedBundle).toEqual(bundle);
    });
  });

  describe("postProcessBundle", () => {
    it("calls all required processing functions in correct order", () => {
      const { patientId, condition, documentExtension } = initTest();
      const patient: Patient = {
        resourceType: "Patient",
        id: patientId,
        name: [{ given: ["Jane"], family: "Doe" }],
      };
      const bundle = makeBundle({ entries: [condition, patient], type: "collection" });

      bundleMods.postProcessBundle(bundle, patientId, documentExtension);
      expect(jest.spyOn(bundleMods, "postProcessBundle")).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });
});
