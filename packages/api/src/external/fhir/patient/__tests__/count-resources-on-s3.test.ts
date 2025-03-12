/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import * as getConsolidatedFromS3File from "@metriport/core/command/consolidated/consolidated-filter";
import { makeAllergyIntollerance } from "@metriport/core/external/fhir/__tests__/allergy-intolerance";
import { makeBundle } from "@metriport/core/external/fhir/__tests__/bundle";
import { makeMedicationRequest } from "@metriport/core/fhir-deduplication/__tests__/examples/medication-related";
import { SearchSetBundle } from "@metriport/shared/medical";
import * as getPatient from "../../../../command/medical/patient/get-patient";
import { makePatientModelSafe } from "../../../../models/medical/__tests__/patient";
import { countResourcesOnS3 } from "../count-resources-on-s3";

let getConsolidatedFromS3_mock: jest.SpyInstance;
let getPatientOrFail_mock: jest.SpyInstance;

beforeEach(() => {
  jest.restoreAllMocks();
  getConsolidatedFromS3_mock = jest
    .spyOn(getConsolidatedFromS3File, "getConsolidatedFromS3")
    .mockImplementation(async () => ({} as SearchSetBundle));
  getPatientOrFail_mock = jest
    .spyOn(getPatient, "getPatientOrFail")
    .mockImplementation(async () => {
      console.log(`mocked `);
      return makePatientModelSafe();
    });
});
afterEach(() => {
  jest.clearAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("countResourcesOnS3", () => {
  it(`returns 0 when no entries on bundle`, async () => {
    const bundle = makeBundle();
    expect(bundle.entry).toBeFalsy();
    getConsolidatedFromS3_mock.mockResolvedValueOnce(bundle);
    const res = await countResourcesOnS3({
      patient: { cxId: "123", id: "456" },
    });
    expect(res).toBeTruthy();
    expect(res.total).toEqual(0);
    expect(res.resources).toBeTruthy();
    const keys = Object.keys(res.resources);
    expect(keys.length).toEqual(0);
  });

  it(`returns 0 when bundle entries is empty`, async () => {
    const bundle = makeBundle({ entries: [] });
    expect(bundle.entry).toBeTruthy();
    expect(bundle.entry?.length).toEqual(0);
    getConsolidatedFromS3_mock.mockResolvedValueOnce(bundle);
    const res = await countResourcesOnS3({
      patient: { cxId: "123", id: "456" },
    });
    expect(res).toBeTruthy();
    expect(res.total).toEqual(0);
    expect(res.resources).toBeTruthy();
    const keys = Object.keys(res.resources);
    expect(keys.length).toEqual(0);
  });

  it(`returns 1 when bundle has a single entry`, async () => {
    const resource = makeAllergyIntollerance();
    const bundle = makeBundle({ entries: [resource] });
    expect(bundle.entry).toBeTruthy();
    expect(bundle.entry?.length).toEqual(1);
    getConsolidatedFromS3_mock.mockResolvedValueOnce(bundle);
    const res = await countResourcesOnS3({
      patient: { cxId: "123", id: "456" },
    });
    expect(res).toBeTruthy();
    expect(res.total).toEqual(1);
    expect(res.resources).toBeTruthy();
    const keys = Object.keys(res.resources);
    expect(keys.length).toEqual(1);
    const resourceCount = Object.entries(res.resources).pop();
    if (!resourceCount) throw new Error("Resource not found");
    expect(resourceCount[0]).toEqual(resource.resourceType);
    expect(resourceCount[1]).toEqual(1);
  });

  it(`returns count of multiple entries for single type`, async () => {
    const resources = [
      makeAllergyIntollerance(),
      makeAllergyIntollerance(),
      makeAllergyIntollerance(),
    ];
    const bundle = makeBundle({ entries: resources });
    expect(bundle.entry).toBeTruthy();
    expect(bundle.entry?.length).toEqual(resources.length);
    getConsolidatedFromS3_mock.mockResolvedValueOnce(bundle);
    const res = await countResourcesOnS3({
      patient: { cxId: "123", id: "456" },
    });
    expect(res).toBeTruthy();
    expect(res.total).toEqual(resources.length);
    expect(res.resources).toBeTruthy();
    const keys = Object.keys(res.resources);
    expect(keys.length).toEqual(1);
    const resourceCount = Object.entries(res.resources).pop();
    if (!resourceCount) throw new Error("Resource not found");
    expect(resourceCount[0]).toEqual(resources[0].resourceType);
    expect(resourceCount[1]).toEqual(resources.length);
  });

  it(`returns count of multiple entries for multiple types`, async () => {
    const allergies = [
      makeAllergyIntollerance(),
      makeAllergyIntollerance(),
      makeAllergyIntollerance(),
    ];
    const medRequests = [makeMedicationRequest(), makeMedicationRequest()];
    const resources = [...allergies, ...medRequests];
    const bundle = makeBundle({ entries: resources });
    expect(bundle.entry).toBeTruthy();
    expect(bundle.entry?.length).toEqual(resources.length);
    getConsolidatedFromS3_mock.mockResolvedValueOnce(bundle);
    const res = await countResourcesOnS3({
      patient: { cxId: "123", id: "456" },
    });
    expect(res).toBeTruthy();
    expect(res.total).toEqual(resources.length);
    expect(res.resources).toBeTruthy();
    const keys = Object.keys(res.resources);
    expect(keys.length).toEqual(2);
    const resAllergies = res.resources.AllergyIntolerance;
    expect(resAllergies).toBeTruthy();
    if (!resAllergies) throw new Error("AllergyIntollerances not found");
    expect(resAllergies).toEqual(allergies.length);
    const resMedicationReqs = res.resources.MedicationRequest;
    expect(resMedicationReqs).toBeTruthy();
    if (!resMedicationReqs) throw new Error("MedicationRequest not found");
    expect(resMedicationReqs).toEqual(medRequests.length);
  });

  it(`forwards params to getConsolidatedFromS3`, async () => {
    const bundle = makeBundle();
    const patient = makePatientModelSafe();
    const dateFrom = faker.date.past().toISOString();
    const dateTo = faker.date.recent().toISOString();
    const resources: ResourceTypeForConsolidation[] = ["MedicationRequest", "Encounter"];
    getConsolidatedFromS3_mock.mockResolvedValueOnce(bundle);
    getPatientOrFail_mock.mockResolvedValueOnce(patient);
    await countResourcesOnS3({
      patient,
      dateFrom,
      dateTo,
      resources,
    });
    expect(getConsolidatedFromS3_mock).toHaveBeenCalledTimes(1);
    expect(getConsolidatedFromS3_mock).toHaveBeenCalledWith({
      cxId: patient.cxId,
      patient,
      dateFrom,
      dateTo,
      resources,
    });
  });
});
