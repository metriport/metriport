import { faker } from "@faker-js/faker";
import { Bundle, Condition, Patient } from "@medplum/fhirtypes";
import { makeBundle } from "../../../external/fhir/__tests__/bundle";
import { buildDocIdFhirExtension } from "../../../external/fhir/shared/extensions/doc-id-extension";
import { snomedCodeMd } from "../../../fhir-deduplication/__tests__/examples/condition-examples";
import { makeCondition } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import {
  FhirExtension,
  addExtensionToConversion,
  addMissingRequests,
  postProcessBundle,
  removePatientFromConversion,
  replaceIDs,
} from "../bundle-modifications";

let bundle: Bundle;
let patientId: string;
let conditionId: string;
let condition: Condition;
let fileName: string;
let documentExtension: FhirExtension;

beforeEach(() => {
  conditionId = faker.string.uuid();
  patientId = faker.string.uuid();
  condition = makeCondition(
    {
      id: conditionId,
      code: { coding: [snomedCodeMd] },
    },
    patientId
  );

  fileName = `${faker.string.uuid()}_${patientId}_${faker.string.uuid()}.xml`;
  documentExtension = buildDocIdFhirExtension(fileName);
});

describe("Checking postProcessBundle and its constituent functions", () => {
  describe("replaceIDs", () => {
    it("does not update the IDs if the extension is missing", () => {
      bundle = makeBundle({ entries: [condition], type: "collection" });
      const updatedBundle = replaceIDs(bundle, patientId);

      const updCondition = updatedBundle.entry?.[0]?.resource;
      expect(updCondition).toBeDefined();
      if (!updCondition) throw new Error("Bundle entry got removed!");

      expect(updCondition.id).toBe(condition.id);
      expect(updCondition).toMatchObject(condition);
    });

    it("updates the ID and adds source metadata when extension is present", () => {
      condition.extension = [documentExtension];
      bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = replaceIDs(bundle, patientId);
      const updCondition = updatedBundle.entry?.[0]?.resource;
      expect(updCondition).toBeDefined();
      if (!updCondition) throw new Error("Bundle entry got removed!");

      expect(updCondition.id).toBeDefined();
      expect(updCondition.id).not.toBe(condition.id);
      expect(updCondition.meta?.source).toBe(fileName);
      expect(updCondition).toMatchObject({
        ...condition,
        id: updCondition.id,
        meta: { source: fileName },
      });
    });

    it("throws error when bundle entry is empty", () => {
      bundle = makeBundle({ entries: [], type: "collection" });
      expect(() => replaceIDs(bundle, patientId)).toThrow("Missing bundle entries");
    });

    it("throws error when bundle has no entries", () => {
      bundle = makeBundle({ type: "collection" });
      expect(() => replaceIDs(bundle, patientId)).toThrow("Missing bundle entries");
    });
  });

  describe("addExtensionToConversion", () => {
    it("adds a document extension to a resource that did not have it", () => {
      bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = addExtensionToConversion(bundle, documentExtension);
      const updCondition = updatedBundle.entry?.[0]?.resource as Condition | undefined;
      expect(updCondition).toBeDefined();
      if (!updCondition) throw new Error("Bundle entry got removed!");

      expect(updCondition.extension).toHaveLength(1);
      expect(updCondition.extension?.[0]).toEqual(documentExtension);
      expect(condition.extension).toBeUndefined();
    });

    it("appends the document extension to a resource with existing extensions", () => {
      const existingExtension = {
        url: "http://example.com/existing",
        valueString: "test",
      };
      condition.extension = [existingExtension];
      bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = addExtensionToConversion(bundle, documentExtension);
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
      bundle = makeBundle({ entries: [], type: "collection" });
      const updatedBundle = addExtensionToConversion(bundle, documentExtension);
      expect(updatedBundle).toEqual(bundle);
    });
  });

  describe("addMissingRequests", () => {
    it("appends a PUT request to each BundleEntry with correct resource references", () => {
      const condition2 = makeCondition({ id: faker.string.uuid() }, patientId);
      bundle = makeBundle({ entries: [condition, condition2], type: "collection" });

      const updatedBundle = addMissingRequests(bundle);
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
      bundle = makeBundle({ entries: [], type: "collection" });
      const updatedBundle = addMissingRequests(bundle);
      expect(updatedBundle).toEqual(bundle);
    });
  });

  describe("removePatientFromConversion", () => {
    it("throws error when multiple Patient resources exist", () => {
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
      bundle = makeBundle({ entries: [condition, patient1, patient2], type: "collection" });

      expect(() => removePatientFromConversion(bundle)).toThrow(
        "Multiple Patient resources found in Bundle"
      );
      expect(bundle.entry).toHaveLength(3);
    });

    it("removes single Patient resource from the Bundle", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: patientId,
        name: [{ given: ["John"], family: "Doe" }],
      };
      bundle = makeBundle({ entries: [condition, patient], type: "collection" });

      const updatedBundle = removePatientFromConversion(bundle);
      expect(updatedBundle.entry).toHaveLength(1);
      expect(updatedBundle.entry?.[0]?.resource?.resourceType).toBe("Condition");
      expect(bundle.entry).toHaveLength(2);
    });

    it("returns bundle unchanged when no entries exist", () => {
      bundle = makeBundle({ entries: [], type: "collection" });
      const updatedBundle = removePatientFromConversion(bundle);
      expect(updatedBundle).toEqual(bundle);
    });
  });

  describe("postProcessBundle", () => {
    it("successfully processes a bundle with all required modifications", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: patientId,
        name: [{ given: ["John"], family: "Doe" }],
      };
      condition.extension = [documentExtension];
      bundle = makeBundle({ entries: [condition, patient], type: "collection" });

      const processedBundle = postProcessBundle(bundle, patientId, documentExtension);

      // Check if IDs were replaced
      const processedCondition = processedBundle.entry?.[0]?.resource as Condition | undefined;
      expect(processedCondition).toBeDefined();
      if (!processedCondition) throw new Error("Bundle entry got removed!");
      expect(processedCondition.id).not.toBe(condition.id);

      // Check if extensions were added
      expect(processedCondition.extension).toContainEqual(documentExtension);

      // Check if requests were added
      expect(processedBundle.entry?.[0]?.request).toEqual({
        method: "PUT",
        url: `${processedCondition.resourceType}/${processedCondition.id}`,
      });

      // Check if patient was removed
      expect(processedBundle.entry).toHaveLength(1);
      expect(processedBundle.entry?.[0]?.resource?.resourceType).not.toBe("Patient");
    });
  });
});
