import { faker } from "@faker-js/faker";
import { Encounter, Resource } from "@medplum/fhirtypes";
import { MarkRequired } from "ts-essentials";
import { getIdFromReference } from "../../../../../external/fhir/shared/references";
import { makeLocation } from "../../../../../external/fhir/__tests__/location";
import { makePatient, PatientWithId } from "../../../../../external/fhir/__tests__/patient";
import { makeReference } from "../../../../../external/fhir/__tests__/reference";
import { FhirSearchResult } from "../../../../../external/opensearch/index-based-on-fhir";
import { OpenSearchFhirSearcher } from "../../../../../external/opensearch/lexical/fhir-searcher";
import { getEntryId as getEntryIdFromOpensearch } from "../../../../../external/opensearch/shared/id";
import { makeCondition } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import {
  makeEncounter as makeEncounterImported,
  makePractitioner,
} from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { hydrateMissingReferences } from "../search-consolidated";

describe("search-consolidated", () => {
  describe("hydrateMissingReferences", () => {
    let cxId: string;
    let patient: PatientWithId;
    let patientId: string;
    let getByIds_mock: jest.SpyInstance;
    let toEntryId: (resource: Resource | string) => string;
    let toGetByIdsResultEntry: (resource: Resource | string) => FhirSearchResult;

    beforeEach(() => {
      cxId = faker.string.uuid();
      patient = makePatient();
      patientId = patient.id;
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
      const resources = [makeCondition(undefined, patient.id)];

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(resources);
      expect(getByIds_mock).not.toHaveBeenCalled();
    });

    it(`hydrates missing first level references`, async () => {
      const missingEncounter = makeEncounter(undefined, patientId);
      const resources = [
        patient,
        makeCondition({ encounter: makeReference(missingEncounter) }, patient.id),
      ];
      const firstLevelReferenceIds = [missingEncounter].map(toEntryId);
      const getByIdsResponse = [missingEncounter].map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsResponse);
      const hydratedResources = [...resources, missingEncounter];

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining(hydratedResources));
      expect(getByIds_mock).toHaveBeenCalledWith({
        cxId,
        patientId,
        ids: firstLevelReferenceIds,
      });
    });

    it(`hydrates missing first and second levels`, async () => {
      const missingLocation = makeLocation({ patient });
      const missingPractitioner = makePractitioner(undefined);
      const missingEncounter = makeEncounter(
        {
          location: [makeReference(missingLocation)],
          participant: [{ individual: makeReference(missingPractitioner) }],
        },
        patientId
      );

      const resources = [
        patient,
        makeCondition({ encounter: makeReference(missingEncounter) }, patient.id),
      ];
      const firstLevelMissingRefs = [missingEncounter];
      const secondLevelMissingRefs = [missingPractitioner, missingLocation];
      const firstLevelReferenceIds = firstLevelMissingRefs.map(toEntryId);
      const secondLevelReferenceIds = secondLevelMissingRefs.map(toEntryId);
      const getByIdsFirstResponse = firstLevelMissingRefs.map(toGetByIdsResultEntry);
      const getByIdsSecondResponse = secondLevelMissingRefs.map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsFirstResponse);
      getByIds_mock.mockResolvedValueOnce(getByIdsSecondResponse);
      const hydratedResources = [
        ...resources,
        missingEncounter,
        missingPractitioner,
        missingLocation,
      ];

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining(hydratedResources));
      expect(getByIds_mock).toHaveBeenNthCalledWith(1, {
        cxId,
        patientId,
        ids: firstLevelReferenceIds,
      });
      expect(getByIds_mock).toHaveBeenNthCalledWith(2, {
        cxId,
        patientId,
        ids: secondLevelReferenceIds,
      });
    });

    it(`respects maximum hydration attempts`, async () => {
      const missingEncounter = makeEncounter(undefined, patientId);
      const resources = [makeCondition({ encounter: makeReference(missingEncounter) }, patient.id)];

      const res = await hydrateMissingReferences({
        cxId,
        patientId,
        resources,
        iteration: 6, // Start over max attempts
      });

      expect(res).toBeTruthy();
      expect(res).toEqual(resources);
      expect(getByIds_mock).not.toHaveBeenCalled(); // Should only try once due to max attempts
    });

    it(`handles missing resources in OpenSearch`, async () => {
      const missingEncounter = makeEncounter(undefined, patientId);
      const resources = [makeCondition({ encounter: makeReference(missingEncounter) }, patient.id)];
      const firstLevelReferenceIds = [missingEncounter].map(toEntryId);
      getByIds_mock.mockResolvedValueOnce([]); // Simulate resource not found

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(resources); // Should return original resources
      expect(getByIds_mock).toHaveBeenCalledWith({
        cxId,
        patientId,
        ids: firstLevelReferenceIds,
      });
    });

    it(`ignores patient references by default`, async () => {
      const missingEncounter = makeEncounter(undefined, patientId);
      const condition = makeCondition({ encounter: makeReference(missingEncounter) }, patient.id);
      if (!condition.subject) throw new Error("Condition subject is required");
      const patientIdFromCondition = getIdFromReference(condition.subject);
      if (patientIdFromCondition !== patientId) {
        throw new Error("Patient ID not matched on Condition");
      }
      const resources = [condition];
      const firstLevelReferenceIds = [missingEncounter].map(toEntryId);
      const getByIdsResponse = [missingEncounter].map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsResponse);

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining([...resources, missingEncounter]));
      expect(getByIds_mock).toHaveBeenCalledWith({
        cxId,
        patientId,
        ids: firstLevelReferenceIds,
      });
    });

    it(`includes patient reference when hydratePatient is true`, async () => {
      const missingEncounter = makeEncounter(undefined, patientId);
      const condition = makeCondition({ encounter: makeReference(missingEncounter) }, patient.id);
      if (!condition.subject) throw new Error("Condition subject is required");
      const patientIdFromCondition = getIdFromReference(condition.subject);
      if (patientIdFromCondition !== patientId) {
        throw new Error("Patient ID not matched on Condition");
      }
      const resources = [condition];
      const firstLevelReferenceIds = [missingEncounter, patient].map(toEntryId);
      const getByIdsResponse = [missingEncounter, patient].map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsResponse);

      const res = await hydrateMissingReferences({
        cxId,
        patientId,
        resources,
        hydratePatient: true,
      });

      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining([...resources, missingEncounter, patient]));
      expect(getByIds_mock).toHaveBeenCalledWith({
        cxId,
        patientId,
        ids: expect.arrayContaining(firstLevelReferenceIds),
      });
    });

    it(`handles circular references`, async () => {
      const missingLocation = makeLocation({ patient });
      const missingEncounter = makeEncounter(
        { location: [makeReference(missingLocation)] },
        patientId
      );

      // Create circular reference: Location -> Encounter -> Location
      const locationWithEncounter = {
        ...missingLocation,
        extension: [
          {
            url: "http://example.com/encounter",
            valueReference: makeReference(missingEncounter),
          },
        ],
      };

      const resources = [makeCondition({ encounter: makeReference(missingEncounter) }, patient.id)];
      const firstLevelMissingRefs = [missingEncounter];
      const secondLevelMissingRefs = [locationWithEncounter];
      const getByIdsFirstResponse = firstLevelMissingRefs.map(toGetByIdsResultEntry);
      const getByIdsSecondResponse = secondLevelMissingRefs.map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsFirstResponse);
      getByIds_mock.mockResolvedValueOnce(getByIdsSecondResponse);

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.arrayContaining([...resources, missingEncounter, locationWithEncounter])
      );
      expect(getByIds_mock).toHaveBeenCalledTimes(2);
    });

    it(`handles multiple references to the same resource`, async () => {
      const missingLocation = makeLocation({ patient });
      const missingPractitioner = makePractitioner(undefined);
      const encounterSeedParams = {
        location: [makeReference(missingLocation)],
        participant: [{ individual: makeReference(missingPractitioner) }],
      };
      const missingEncounter1 = makeEncounter(encounterSeedParams, patientId);
      const missingEncounter2 = makeEncounter(encounterSeedParams, patientId);

      const resources = [
        makeCondition({ encounter: makeReference(missingEncounter1) }, patient.id),
        makeCondition({ encounter: makeReference(missingEncounter2) }, patient.id),
      ];
      const firstLevelMissingRefs = [missingEncounter1, missingEncounter2];
      const secondLevelMissingRefs = [missingLocation, missingPractitioner];
      const secondLevelReferenceIds = secondLevelMissingRefs.map(toEntryId);
      const getByIdsFirstResponse = firstLevelMissingRefs.map(toGetByIdsResultEntry);
      const getByIdsSecondResponse = secondLevelMissingRefs.map(toGetByIdsResultEntry);
      getByIds_mock.mockResolvedValueOnce(getByIdsFirstResponse);
      getByIds_mock.mockResolvedValueOnce(getByIdsSecondResponse);

      const res = await hydrateMissingReferences({ cxId, patientId, resources });

      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.arrayContaining([
          ...resources,
          missingEncounter1,
          missingEncounter2,
          missingLocation,
          missingPractitioner,
        ])
      );
      expect(getByIds_mock).toHaveBeenCalledTimes(2);
      // Verify we don't try to fetch the same resource multiple times
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

function makeEncounter(
  params: Partial<Encounter> | undefined,
  patientId: string
): MarkRequired<Encounter, "id"> {
  const encounter = makeEncounterImported(params, { patient: patientId });
  if (!params?.participant) encounter.participant = [];
  if (!params?.location) encounter.location = [];
  if (!encounter.id) throw new Error("Encounter ID is required");
  return { ...encounter, id: encounter.id };
}
