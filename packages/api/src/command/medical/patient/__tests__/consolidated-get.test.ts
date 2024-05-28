/* eslint-disable @typescript-eslint/no-empty-function */
import { Observation } from "@medplum/fhirtypes";
import { HapiFhirClient } from "@metriport/core/external/fhir/api/api-hapi";
import { v4 as uuidv4 } from "uuid";
import { makePatient } from "../../../../domain/medical/__tests__/patient";
import { getConsolidatedPatientData, getCurrentConsolidatedProgress } from "../consolidated-get";
import { consolidatedQuery } from "./store-query-cmd";
import * as getPatient from "../get-patient";

let getPatientOrFailMock: jest.SpyInstance;
let fhir_searchResourcePages: jest.SpyInstance;
jest.mock("../../../../models/medical/patient");

beforeEach(() => {
  jest.restoreAllMocks();
  getPatientOrFailMock = jest.spyOn(getPatient, "getPatientOrFail");
  fhir_searchResourcePages = jest.spyOn(HapiFhirClient.prototype, "searchResourcePages");
});

describe("getConsolidatedPatientData", () => {
  const cxId = uuidv4();
  const patientId = uuidv4();

  it("paginates appropriately", async () => {
    getPatientOrFailMock.mockReturnValueOnce(makePatient({ id: patientId }));

    const returnedResource: Observation = {
      resourceType: "Observation",
      id: "1",
      status: "final",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "12345",
            display: "Test",
          },
        ],
      },
    };
    const generator = (async function* generateResources() {
      yield [returnedResource];
      yield [returnedResource];
    })();
    fhir_searchResourcePages.mockReturnValue(generator);

    const resp = await getConsolidatedPatientData({
      patient: { cxId, id: patientId },
      resources: ["Observation"],
    });

    expect(resp).toBeTruthy();
    expect(resp.resourceType).toEqual(`Bundle`);
    expect(resp.total).toEqual(2);
    expect(resp.entry).toEqual(expect.arrayContaining([{ resource: returnedResource }]));
    expect(fhir_searchResourcePages).toHaveBeenCalledTimes(1);
  });
});

describe("getCurrentConsolidatedProgress", () => {
  it("return undefined when there is no consolidated progress", () => {
    const resp = getCurrentConsolidatedProgress(undefined, {});

    expect(resp).toBeUndefined();
  });

  it("return undefined when consolidated progress is present but params dont match", () => {
    const resp = getCurrentConsolidatedProgress(consolidatedQuery, {});

    expect(resp).toBeUndefined();
  });

  it("return consolidated progress when consolidated progress is present and params match", () => {
    const consolidatedProgress = Object.values(consolidatedQuery)[0];

    const resp = getCurrentConsolidatedProgress(consolidatedQuery, {
      resources: consolidatedProgress.resources,
      dateFrom: consolidatedProgress.dateFrom,
      dateTo: consolidatedProgress.dateTo,
      conversionType: consolidatedProgress.conversionType,
    });

    expect(resp).toEqual(consolidatedProgress);
  });
});
