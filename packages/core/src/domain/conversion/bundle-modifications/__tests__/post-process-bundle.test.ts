import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { makeBundle } from "../../../../external/fhir/__tests__/bundle";
import * as bundleShared from "../../../../external/fhir/bundle/bundle";
import { buildDocIdFhirExtension } from "../../../../external/fhir/shared/extensions/doc-id-extension";
import { snomedCodeMd } from "../../../../fhir-deduplication/__tests__/examples/condition-examples";
import { makeCondition } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { makePatient } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-patient";
import * as bundleMods from "../modifications";
import { postProcessBundle } from "../post-process";

let addExtensionToConversionMock: jest.SpyInstance;
let replaceIdsMock: jest.SpyInstance;
let createFullBundleEntriesMock: jest.SpyInstance;
let removePatientFromConversionMock: jest.SpyInstance;

beforeAll(() => {
  addExtensionToConversionMock = jest.spyOn(bundleMods, "addExtensionToConversion");
  replaceIdsMock = jest.spyOn(bundleMods, "replaceIdsForResourcesWithDocExtension");
  createFullBundleEntriesMock = jest.spyOn(bundleShared, "createFullBundleEntries");
  removePatientFromConversionMock = jest.spyOn(bundleMods, "removePatientFromConversion");
});
afterEach(() => {
  jest.clearAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

function makeFilename(patientId: string = faker.string.uuid()): string {
  return `${faker.string.uuid()}_${patientId}_${faker.string.uuid()}.xml`;
}

function initTest() {
  const patientId = faker.string.uuid();
  const condition = makeCondition(
    {
      code: { coding: [snomedCodeMd] },
    },
    patientId
  );
  const fileName = makeFilename(patientId);
  const documentExtension = buildDocIdFhirExtension(fileName);
  return { patientId, condition, fileName, documentExtension };
}

describe("Checking postProcessBundle and its constituent functions", () => {
  describe("replaceIdsForResourcesWithDocExtension", () => {
    it("does not update the IDs if the extension is missing", () => {
      const { patientId, condition } = initTest();
      const bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = bundleMods.replaceIdsForResourcesWithDocExtension(bundle, patientId);
      expect(updatedBundle.entry).toBeDefined();
      expect(updatedBundle.entry).toHaveLength(1);

      const updEntry = updatedBundle.entry?.[0];
      expect(updEntry).toBeDefined();
      expect(updEntry?.resource?.resourceType).toEqual("Condition");

      const updCondition = updEntry?.resource as Condition;
      expect(updCondition.id).toEqual(condition.id);
      expect(updCondition).toMatchObject(condition);
    });

    it("updates the ID and adds source metadata when extension is present", () => {
      const { patientId, condition, fileName, documentExtension } = initTest();
      condition.extension = [documentExtension];
      const bundle = makeBundle({ entries: [condition], type: "collection" });

      const updatedBundle = bundleMods.replaceIdsForResourcesWithDocExtension(bundle, patientId);
      expect(updatedBundle.entry).toBeDefined();
      expect(updatedBundle.entry).toHaveLength(1);

      const updEntry = updatedBundle.entry?.[0];
      expect(updEntry).toBeDefined();
      expect(updEntry?.resource?.resourceType).toEqual("Condition");

      const updCondition = updEntry?.resource as Condition;
      expect(updCondition.id).not.toEqual(condition.id);
      expect(updCondition.meta?.source).toEqual(fileName);
      expect(updCondition).toMatchObject({
        ...condition,
        id: updCondition?.id,
        meta: { source: fileName },
      });
    });

    it("throws error when bundle entry is empty", () => {
      const { patientId } = initTest();
      const bundle = makeBundle({ entries: [], type: "collection" });
      expect(() => bundleMods.replaceIdsForResourcesWithDocExtension(bundle, patientId)).toThrow(
        "Missing bundle entries"
      );
    });

    it("throws error when bundle has no entries", () => {
      const { patientId } = initTest();
      const bundle = makeBundle({ type: "collection" });
      expect(() => bundleMods.replaceIdsForResourcesWithDocExtension(bundle, patientId)).toThrow(
        "Missing bundle entries"
      );
    });
  });

  describe("addExtensionToConversion", () => {
    it("adds a document extension to a resource that did not have it", () => {
      const { condition, documentExtension } = initTest();
      expect(condition.extension).toBeUndefined();

      const bundle = makeBundle({ entries: [condition], type: "collection" });
      const updatedBundle = bundleMods.addExtensionToConversion(bundle, documentExtension);

      const updResource = updatedBundle.entry?.[0]?.resource;
      expect(updResource).toBeDefined();
      expect(updResource?.resourceType).toEqual("Condition");

      const updCondition = updResource as Condition;
      expect(updCondition.extension).toHaveLength(1);
      expect(updCondition.extension?.[0]).toEqual(documentExtension);
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
      expect(updatedBundle.entry).toHaveLength(1);
      const updResource = updatedBundle.entry?.[0]?.resource;
      expect(updResource).toBeDefined();
      expect(updResource?.resourceType).toEqual("Condition");

      const updCondition = updResource as Condition;
      expect(updCondition.extension).toHaveLength(2);
      expect(updCondition.extension).toEqual(
        expect.arrayContaining([existingExtension, documentExtension])
      );
    });

    it("returns bundle unchanged when no entries exist", () => {
      const { documentExtension } = initTest();
      const bundle = makeBundle({ entries: [], type: "collection" });
      const updatedBundle = bundleMods.addExtensionToConversion(bundle, documentExtension);
      expect(updatedBundle).toEqual(bundle);
    });
  });

  describe("removePatientFromConversion", () => {
    it("removes single Patient resource from the Bundle", () => {
      const { condition } = initTest();
      const patient = makePatient({
        name: [{ given: ["John"], family: "Doe" }],
      });
      const bundle = makeBundle({ entries: [condition, patient], type: "collection" });

      const updatedBundle = bundleMods.removePatientFromConversion(bundle);
      expect(updatedBundle.entry).toHaveLength(1);
      expect(updatedBundle.entry?.[0]?.resource).toEqual(condition);
    });

    it("removes all Patient resources from the Bundle", () => {
      const { condition } = initTest();
      const patient1 = makePatient({
        name: [{ given: ["John"], family: "Doe" }],
      });
      const patient2 = makePatient({
        name: [{ given: ["Jane"], family: "Doe" }],
      });
      const bundle = makeBundle({
        entries: [condition, patient1, patient2],
        type: "collection",
      });

      const updatedBundle = bundleMods.removePatientFromConversion(bundle);
      expect(updatedBundle.entry).toHaveLength(1);
      expect(updatedBundle.entry?.[0]?.resource).toEqual(condition);
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
      const patient = makePatient({
        id: patientId,
        name: [{ given: ["Jane"], family: "Doe" }],
      });
      const bundle = makeBundle({ entries: [condition, patient], type: "collection" });

      postProcessBundle(bundle, patientId, documentExtension);

      expect(addExtensionToConversionMock).toHaveBeenCalled();
      expect(replaceIdsMock).toHaveBeenCalled();
      expect(createFullBundleEntriesMock).toHaveBeenCalled();
      expect(removePatientFromConversionMock).toHaveBeenCalled();

      // Check relative order of execution
      const addExtensionOrder = addExtensionToConversionMock.mock.invocationCallOrder[0];
      const replaceIdsOrder = replaceIdsMock.mock.invocationCallOrder[0];
      const addRequestsOrder = createFullBundleEntriesMock.mock.invocationCallOrder[0];
      const removePatientOrder = removePatientFromConversionMock.mock.invocationCallOrder[0];

      if (!addExtensionOrder) throw new Error("Failed to get addExtensionOrder");
      if (!replaceIdsOrder) throw new Error("Failed to get replaceIdsOrder");
      if (!addRequestsOrder) throw new Error("Failed to get addRequestsOrder");
      if (!removePatientOrder) throw new Error("Failed to get removePatientOrder");

      expect(addExtensionOrder).toBeLessThan(replaceIdsOrder);
      expect(addExtensionOrder).toBeLessThan(addRequestsOrder);
      expect(addRequestsOrder).toBeLessThan(removePatientOrder);
    });
  });
});
