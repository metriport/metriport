import { Resource } from "@medplum/fhirtypes";
import { getIdFromReference } from "../../../../../external/fhir/shared/references";
import { makeReference } from "../../../../../external/fhir/__tests__/reference";
import { FhirSearchResult } from "../../../../../external/opensearch/index-based-on-fhir";
import { OpenSearchFhirSearcher } from "../../../../../external/opensearch/lexical/fhir-searcher";
import { getEntryId as getEntryIdFromOpensearch } from "../../../../../external/opensearch/shared/id";
import { makeCondition } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { makePractitioner } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { makeOrganization } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-organization";
import { hydrateMissingReferences } from "../search-consolidated";
import {
  cxId,
  Entry,
  genericHydration,
  makePractitionerWithOrg,
  nonSpecializedHydration,
  patient,
  patientId,
  specializedHydration,
} from "./search-consolidated-setup";

describe("search-consolidated", () => {
  describe("hydrateMissingReferences", () => {
    let getByIds_mock: jest.SpyInstance;
    let toEntryId: (resource: Resource | string) => string;
    let toGetByIdsResultEntry: (resource: Resource | string) => FhirSearchResult;

    beforeEach(() => {
      getByIds_mock = jest
        .spyOn(OpenSearchFhirSearcher.prototype, "getByIds")
        .mockResolvedValue([]);
      toEntryId = makeToEntryId(cxId, patientId);
      toGetByIdsResultEntry = makeToGetByIdsResultEntry(cxId, patientId, toEntryId);
    });
    afterEach(() => {
      getByIds_mock.mockRestore();
    });

    it(`returns original array when nothing to hydrate`, async () => {
      const resources = [makeCondition(undefined, patientId)];

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(resources);
      expect(getByIds_mock).not.toHaveBeenCalled();
    });

    describe("general hydration", () => {
      runTest(genericHydration.conditionAndPractitioner);
      runTest(genericHydration.practitionerAndOrganization);
      runTest(genericHydration.medicationAdministrationAndPractitioner);
      runTest(specializedHydration.diagnosticReportAndPractitioner);
      runTest(specializedHydration.diagnosticReportAndOrganization);

      function runTest<T extends Resource, M extends Resource>({
        makeInputResource,
        resourceType,
        missingResource,
        missingResourceType,
      }: Entry<T, M>) {
        it(`hydrates missing ${missingResourceType} references when resource is ${resourceType}`, async () => {
          const inputResources = [patient, makeInputResource(missingResource)];
          const firstLevelReferenceIds = [missingResource].map(toEntryId);
          const getByIdsResponse = [missingResource].map(toGetByIdsResultEntry);
          getByIds_mock.mockResolvedValueOnce(getByIdsResponse);
          const hydratedResources = [...inputResources, missingResource];

          const res = await hydrateMissingReferences({
            cxId,
            patientId,
            resources: inputResources,
          });

          expect(res).toBeTruthy();
          expect(res).toEqual(expect.arrayContaining(hydratedResources));
          expect(getByIds_mock).toHaveBeenCalledWith({
            cxId,
            patientId,
            ids: expect.arrayContaining(firstLevelReferenceIds),
          });
        });
      }
    });

    it(`hydrates missing second level Org ref when resource is Condition and it has a missing ref to Practitioner`, async () => {
      const missingSecondLevel = makeOrganization();
      const missingFirstLevel = makePractitionerWithOrg(missingSecondLevel);
      const resources = [
        patient,
        makeCondition({ recorder: makeReference(missingFirstLevel) }, patientId),
      ];
      const firstLevelMissingRefs = [missingFirstLevel];
      const secondLevelMissingRefs = [missingSecondLevel];
      const firstLevelReferenceIds = firstLevelMissingRefs.map(toEntryId);
      const secondLevelReferenceIds = secondLevelMissingRefs.map(toEntryId);
      const getByIdsFirstResponse = firstLevelMissingRefs.map(toGetByIdsResultEntry);
      const getByIdsSecondResponse = secondLevelMissingRefs.map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsFirstResponse);
      getByIds_mock.mockResolvedValueOnce(getByIdsSecondResponse);
      const hydratedResources = [...resources, missingFirstLevel, missingSecondLevel];

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining(hydratedResources));
      expect(getByIds_mock).toHaveBeenNthCalledWith(1, {
        cxId,
        patientId,
        ids: expect.arrayContaining(firstLevelReferenceIds),
      });
      expect(getByIds_mock).toHaveBeenNthCalledWith(2, {
        cxId,
        patientId,
        ids: expect.arrayContaining(secondLevelReferenceIds),
      });
    });

    describe("non-specialized hydration", () => {
      runTest(nonSpecializedHydration.conditionAndEncounter);
      runTest(nonSpecializedHydration.conditionAndObservation);
      runTest(nonSpecializedHydration.encounterAndObservation);

      function runTest<T extends Resource, M extends Resource>({
        makeInputResource,
        resourceType,
        missingResource,
        missingResourceType,
      }: Entry<T, M>) {
        it(`does NOT hydrate missing ${missingResourceType} when resource is ${resourceType}`, async () => {
          const inputResources = [patient, makeInputResource(missingResource)];
          const firstLevelReferenceIds = [missingResource].map(toEntryId);
          const getByIdsResponse = [missingResource].map(toGetByIdsResultEntry);
          getByIds_mock.mockResolvedValueOnce(getByIdsResponse);
          const hydratedResources = inputResources;

          const res = await hydrateMissingReferences({
            cxId,
            patientId,
            resources: inputResources,
          });

          expect(res).toBeTruthy();
          expect(res).toEqual(expect.arrayContaining(hydratedResources));
          expect(getByIds_mock).not.toHaveBeenCalledWith({
            cxId,
            patientId,
            ids: expect.arrayContaining(firstLevelReferenceIds),
          });
        });
      }
    });

    describe("specialized hydration", () => {
      runTest(specializedHydration.diagnosticReportAndEncounter);
      runTest(specializedHydration.diagnosticReportAndObservation);
      runTest(specializedHydration.medicationAdministrationAndMedication);
      runTest(specializedHydration.medicationRequestAndMedication);
      runTest(specializedHydration.medicationDispenseAndMedication);

      function runTest<T extends Resource, M extends Resource>({
        makeInputResource,
        resourceType,
        missingResource,
        missingResourceType,
      }: Entry<T, M>) {
        it(`hydrates missing ${missingResourceType} when resource is ${resourceType}`, async () => {
          const inputResources = [patient, makeInputResource(missingResource)];
          const firstLevelReferenceIds = [missingResource].map(toEntryId);
          const getByIdsResponse = [missingResource].map(toGetByIdsResultEntry);
          getByIds_mock.mockResolvedValueOnce(getByIdsResponse);
          const hydratedResources = [...inputResources, missingResource];

          const res = await hydrateMissingReferences({
            cxId,
            patientId,
            resources: inputResources,
          });

          expect(res).toBeTruthy();
          expect(res).toEqual(expect.arrayContaining(hydratedResources));
          expect(getByIds_mock).toHaveBeenCalledWith({
            cxId,
            patientId,
            ids: expect.arrayContaining(firstLevelReferenceIds),
          });
        });
      }
    });

    it(`respects maximum hydration attempts`, async () => {
      const missingFirstLevel = makePractitioner();
      const inputResources = [
        makeCondition({ recorder: makeReference(missingFirstLevel) }, patientId),
      ];

      const res = await hydrateMissingReferences({
        cxId,
        patientId,
        resources: inputResources,
        iteration: 6, // Start beyond max attempts
      });

      expect(res).toBeTruthy();
      expect(res).toEqual(inputResources);
      expect(getByIds_mock).not.toHaveBeenCalled();
    });

    it(`handles not finding missing references in OpenSearch`, async () => {
      const missingFirstLevel = makePractitioner();
      const inputResources = [
        makeCondition({ recorder: makeReference(missingFirstLevel) }, patientId),
      ];
      const firstLevelReferenceIds = [missingFirstLevel].map(toEntryId);
      getByIds_mock.mockResolvedValueOnce([]); // Simulate resource not found

      const res = await hydrateMissingReferences({ cxId, patientId, resources: inputResources });

      expect(res).toBeTruthy();
      expect(res).toEqual(inputResources);
      expect(getByIds_mock).toHaveBeenCalledWith({
        cxId,
        patientId,
        ids: expect.arrayContaining(firstLevelReferenceIds),
      });
    });

    it(`ignores patient references`, async () => {
      const missingFirstLevel = makePractitioner();
      const condition = makeCondition({ recorder: makeReference(missingFirstLevel) }, patientId);
      if (!condition.subject) throw new Error("Condition subject is required");
      const patientIdFromCondition = getIdFromReference(condition.subject);
      if (patientIdFromCondition !== patientId) {
        throw new Error("Patient ID not matched on Condition");
      }
      const resources = [condition];
      const firstLevelReferences = [missingFirstLevel];
      const firstLevelReferenceIds = firstLevelReferences.map(toEntryId);
      const getByIdsResponse = firstLevelReferences.map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsResponse);

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining([...resources, missingFirstLevel]));
      expect(getByIds_mock).toHaveBeenCalledWith({
        cxId,
        patientId,
        ids: expect.arrayContaining(firstLevelReferenceIds),
      });
    });

    it(`handles circular references`, async () => {
      const org1 = makeOrganization(undefined, patientId);
      const org2 = makeOrganization({ partOf: makeReference(org1) }, patientId);
      org1.partOf = makeReference(org2);

      const inputResources = [org1];
      const firstLevelMissingRefs = [org2];
      const secondLevelMissingRefs = [org1];
      const getByIdsFirstResponse = firstLevelMissingRefs.map(toGetByIdsResultEntry);
      const getByIdsSecondResponse = secondLevelMissingRefs.map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsFirstResponse);
      getByIds_mock.mockResolvedValueOnce(getByIdsSecondResponse);

      const res = await hydrateMissingReferences({ cxId, patientId, resources: inputResources });

      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining([...inputResources, org2]));
      expect(getByIds_mock).toHaveBeenCalledTimes(1);
    });

    it(`handles multiple references to the same resource`, async () => {
      const secondLevelMissingOrg = makeOrganization(undefined, patientId);
      const firstLevelMissingPractitioner1 = makePractitionerWithOrg(secondLevelMissingOrg);
      const firstLevelMissingPractitioner2 = makePractitionerWithOrg(secondLevelMissingOrg);

      const resources = [
        makeCondition({ recorder: makeReference(firstLevelMissingPractitioner1) }, patientId),
        makeCondition({ recorder: makeReference(firstLevelMissingPractitioner2) }, patientId),
      ];
      const firstLevelMissingRefs = [
        firstLevelMissingPractitioner1,
        firstLevelMissingPractitioner2,
      ];
      const firstLevelMissingRefsIds = firstLevelMissingRefs.map(toEntryId);
      const secondLevelMissingRefs = [secondLevelMissingOrg];
      const secondLevelReferenceIds = secondLevelMissingRefs.map(toEntryId);
      const getByIdsFirstResponse = firstLevelMissingRefs.map(toGetByIdsResultEntry);
      const getByIdsSecondResponse = secondLevelMissingRefs.map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsFirstResponse);
      getByIds_mock.mockResolvedValueOnce(getByIdsSecondResponse);

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      const expectedResourceCount = resources.length + 3;
      expect(res.length).toEqual(expectedResourceCount);
      expect(res).toEqual(
        expect.arrayContaining([
          ...resources,
          firstLevelMissingPractitioner1,
          firstLevelMissingPractitioner2,
          secondLevelMissingOrg,
        ])
      );
      expect(getByIds_mock).toHaveBeenCalledTimes(2);
      expect(getByIds_mock).toHaveBeenNthCalledWith(1, {
        cxId,
        patientId,
        ids: expect.arrayContaining(firstLevelMissingRefsIds),
      });
      expect(getByIds_mock).toHaveBeenNthCalledWith(2, {
        cxId,
        patientId,
        ids: expect.arrayContaining(secondLevelReferenceIds),
      });
    });
  });
});

function makeToEntryId(cxId: string, patientId: string) {
  return (resource: Resource | string) => {
    if (typeof resource === "string") {
      if (resource.startsWith("urn:uuid:")) return resource.slice(9);
      const refId = resource.split("/").pop();
      if (!refId) throw new Error(`Invalid reference: ${resource}`);
      return refId;
    }
    if (!resource.id) throw new Error(`Resource ID is required`);
    return getEntryIdFromOpensearch(cxId, patientId, resource.id);
  };
}

function makeToGetByIdsResultEntry(
  cxId: string,
  patientId: string,
  toEntryId: (resource: Resource | string) => string
) {
  return (resource: Resource | string): FhirSearchResult => {
    if (typeof resource === "string") {
      return {
        cxId,
        patientId,
        entryId: toEntryId(resource),
        resourceType: "UNKNOWN",
        resourceId: resource,
        rawContent: JSON.stringify({ resourceType: "UNKNOWN", resourceId: resource }),
      };
    }
    if (!resource.id) throw new Error(`Resource ID is required`);
    return {
      cxId,
      patientId,
      entryId: toEntryId(resource),
      resourceType: resource.resourceType,
      resourceId: resource.id,
      rawContent: JSON.stringify(resource),
    };
  };
}
