/* eslint-disable @typescript-eslint/no-empty-function */
import { Observation } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import { makePatient } from "../../../../domain/__tests__/patient";
import { Config } from "../../../../util/config";
import { HapiFhirClient } from "../../api/api-hapi";
import * as fhirBundle from "../../bundle/bundle";
import * as fhirReferences from "../../shared/references";
import { getConsolidatedFhirBundle } from "../consolidated";

let fhir_searchResourcePages: jest.SpyInstance;
let fhir_getReferencesFromResources: jest.SpyInstance;
let fhir_getReferencesFromFHIR: jest.SpyInstance;

beforeEach(() => {
  jest.restoreAllMocks();
  Config.getFHIRServerUrl = jest.fn(() => "http://localhost:8888");
  fhir_searchResourcePages = jest.spyOn(HapiFhirClient.prototype, "searchResourcePages");
  fhir_getReferencesFromResources = jest.spyOn(fhirBundle, "getReferencesFromResources");
  fhir_getReferencesFromFHIR = jest.spyOn(fhirReferences, "getReferencesFromFHIR");
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("getConsolidatedFhirBundle", () => {
  const cxId = uuidv4();
  const patientId = uuidv4();

  it("paginates appropriately", async () => {
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

    const resp = await getConsolidatedFhirBundle({
      patient: makePatient({ cxId, id: patientId }),
      resources: ["Observation"],
    });

    expect(resp).toBeTruthy();
    expect(resp.resourceType).toEqual(`Bundle`);
    expect(resp.total).toEqual(2);
    expect(resp.entry).toEqual(
      expect.arrayContaining([expect.objectContaining({ resource: returnedResource })])
    );
    expect(fhir_searchResourcePages).toHaveBeenCalledTimes(1);
  });

  it("hydration full 3 levels", async () => {
    const initialResource: Observation = {
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
      subject: { reference: "Observation/2" },
    };
    const generator = (async function* generateResources() {
      yield [initialResource];
    })();
    fhir_searchResourcePages.mockReturnValue(generator);

    const missingResourceBaseL1: Observation = {
      resourceType: "Observation",
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
      id: "2",
      subject: { reference: "Observation/3" },
    };
    const missingL2: Observation = {
      ...missingResourceBaseL1,
      id: "3",
      subject: { reference: "Observation/4" },
    };
    const missingL3: Observation = {
      ...missingResourceBaseL1,
      id: "4",
      subject: { reference: "Observation/5" },
    };
    const missingL4: Observation = {
      ...missingResourceBaseL1,
      id: "5",
      subject: { reference: "Observation/6" },
    };
    fhir_getReferencesFromFHIR
      .mockReturnValueOnce([missingResourceBaseL1])
      .mockReturnValueOnce([missingL2])
      .mockReturnValueOnce([missingL3])
      .mockReturnValueOnce([missingL4]);

    const resp = await getConsolidatedFhirBundle({
      patient: makePatient({ cxId, id: patientId }),
      resources: ["Observation"],
    });

    expect(resp).toBeTruthy();
    expect(resp.resourceType).toEqual(`Bundle`);
    expect(resp.total).toEqual(4);
    expect(resp.entry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: initialResource }),
        expect.objectContaining({ resource: missingResourceBaseL1 }),
        expect.objectContaining({ resource: missingL2 }),
        expect.objectContaining({ resource: missingL3 }),
      ])
    );
    expect(fhir_searchResourcePages).toHaveBeenCalledTimes(1);
    expect(fhir_getReferencesFromResources).toHaveBeenCalledTimes(3);
    expect(fhir_getReferencesFromFHIR).toHaveBeenCalledTimes(3);
  });

  it("hydration full 2 levels", async () => {
    const initialResource: Observation = {
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
      subject: { reference: "Observation/2" },
    };
    const generator = (async function* generateResources() {
      yield [initialResource];
    })();
    fhir_searchResourcePages.mockReturnValue(generator);

    const missingResourceBaseL1: Observation = {
      resourceType: "Observation",
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
      id: "2",
      subject: { reference: "Observation/3" },
    };
    const missingL2: Observation = {
      ...missingResourceBaseL1,
      id: "3",
    };
    const missingL3: Observation = {
      ...missingResourceBaseL1,
      id: "4",
      subject: { reference: "Observation/5" },
    };
    fhir_getReferencesFromFHIR
      .mockReturnValueOnce([missingResourceBaseL1])
      .mockReturnValueOnce([missingL2])
      .mockReturnValueOnce([missingL3]);

    const resp = await getConsolidatedFhirBundle({
      patient: makePatient({ cxId, id: patientId }),
      resources: ["Observation"],
    });

    expect(resp).toBeTruthy();
    expect(resp.resourceType).toEqual(`Bundle`);
    expect(resp.total).toEqual(3);
    expect(resp.entry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: initialResource }),
        expect.objectContaining({ resource: missingResourceBaseL1 }),
        expect.objectContaining({ resource: missingL2 }),
      ])
    );
    expect(fhir_searchResourcePages).toHaveBeenCalledTimes(1);
    expect(fhir_getReferencesFromResources).toHaveBeenCalledTimes(3);
    expect(fhir_getReferencesFromFHIR).toHaveBeenCalledTimes(2);
  });
});
