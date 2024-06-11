/* eslint-disable @typescript-eslint/no-empty-function */
import { Observation } from "@medplum/fhirtypes";
import { HapiFhirClient } from "@metriport/core/external/fhir/api/api-hapi";
import { resourcesSearchableByPatient } from "@metriport/api-sdk";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { makePatient } from "../../../../domain/medical/__tests__/patient";
import {
  getConsolidatedPatientData,
  getCurrentConsolidatedProgress,
  getIsSameResources,
} from "../consolidated-get";
import { makeConsolidatedQueryProgress, requestId } from "./store-query-cmd";
import * as getPatient from "../get-patient";

let getPatientOrFailMock: jest.SpyInstance;
let fhir_searchResourcePages: jest.SpyInstance;
const defaultConsolidatedProgress = makeConsolidatedQueryProgress({
  requestId: requestId,
  status: "processing",
  startedAt: new Date(),
  resources: [],
  conversionType: "json",
  dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
  dateTo: dayjs().add(1, "day").format(ISO_DATE),
});

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

  it("return undefined when there is no consolidated progress and we have params", () => {
    const resp = getCurrentConsolidatedProgress(undefined, {
      resources: ["Observation"],
      dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
      dateTo: dayjs().add(1, "day").format(ISO_DATE),
      conversionType: "json",
    });

    expect(resp).toBeUndefined();
  });

  it("return undefined when consolidated progress empty array and we have params", () => {
    const resp = getCurrentConsolidatedProgress([], {
      resources: ["Observation"],
      dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
      dateTo: dayjs().add(1, "day").format(ISO_DATE),
      conversionType: "json",
    });

    expect(resp).toBeUndefined();
  });

  it("return undefined when consolidated progress is present but params are empty", () => {
    const consolidatedQueryProgress = makeConsolidatedQueryProgress(defaultConsolidatedProgress);
    const secondConsolidatedQueryProgress = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      requestId: uuidv4(),
      status: "completed",
      conversionType: "pdf",
    });
    const resp = getCurrentConsolidatedProgress(
      [consolidatedQueryProgress, secondConsolidatedQueryProgress],
      {}
    );

    expect(resp).toBeUndefined();
  });

  it("return undefined when consolidated progress is present but params dont match", () => {
    const consolidatedQueryProgress = makeConsolidatedQueryProgress(defaultConsolidatedProgress);
    const secondConsolidatedQueryProgress = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      requestId: uuidv4(),
      status: "completed",
      conversionType: "pdf",
    });
    const resp = getCurrentConsolidatedProgress(
      [consolidatedQueryProgress, secondConsolidatedQueryProgress],
      {
        resources: ["Observation"],
        dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
        dateTo: dayjs().add(1, "day").format(ISO_DATE),
        conversionType: "pdf",
      }
    );

    expect(resp).toBeUndefined();
  });

  it("return undefined when consolidated progress is present and params match but is completed", () => {
    const consolidatedQueryProgress = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      status: "completed",
    });
    const secondConsolidatedQueryProgress = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      requestId: uuidv4(),
      status: "completed",
      conversionType: "pdf",
    });
    const resp = getCurrentConsolidatedProgress(
      [consolidatedQueryProgress, secondConsolidatedQueryProgress],
      {
        resources: consolidatedQueryProgress.resources,
        dateFrom: consolidatedQueryProgress.dateFrom,
        dateTo: consolidatedQueryProgress.dateTo,
        conversionType: consolidatedQueryProgress.conversionType,
      }
    );

    expect(resp).toBeUndefined();
  });

  it("return consolidated progress when consolidated progress is present and params match", () => {
    const consolidatedProgress = makeConsolidatedQueryProgress(defaultConsolidatedProgress);
    const secondConsolidatedQueryProgress = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      requestId: uuidv4(),
      status: "completed",
      conversionType: "pdf",
    });
    const resp = getCurrentConsolidatedProgress(
      [consolidatedProgress, secondConsolidatedQueryProgress],
      {
        resources: consolidatedProgress.resources,
        dateFrom: consolidatedProgress.dateFrom,
        dateTo: consolidatedProgress.dateTo,
        conversionType: consolidatedProgress.conversionType,
      }
    );

    expect(resp).toEqual(consolidatedProgress);
  });

  it("return consolidated progress when consolidated progress is present with empty resource array and resources is the full list", () => {
    const consolidatedProgress = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      resources: [...resourcesSearchableByPatient],
    });
    const secondConsolidatedQueryProgress = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      requestId: uuidv4(),
      resources: ["Observation"],
    });
    const resp = getCurrentConsolidatedProgress(
      [consolidatedProgress, secondConsolidatedQueryProgress],
      {
        resources: [],
        dateFrom: consolidatedProgress.dateFrom,
        dateTo: consolidatedProgress.dateTo,
        conversionType: consolidatedProgress.conversionType,
      }
    );

    expect(resp).toEqual(consolidatedProgress);
  });

  it("return consolidated progress when consolidated progress is present with full resource array and resources is empty", () => {
    const consolidatedProgress = makeConsolidatedQueryProgress(defaultConsolidatedProgress);
    const secondConsolidatedQueryProgress = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      requestId: uuidv4(),
      resources: ["Observation"],
    });
    const resp = getCurrentConsolidatedProgress(
      [consolidatedProgress, secondConsolidatedQueryProgress],
      {
        resources: [...resourcesSearchableByPatient],
        dateFrom: consolidatedProgress.dateFrom,
        dateTo: consolidatedProgress.dateTo,
        conversionType: consolidatedProgress.conversionType,
      }
    );

    expect(resp).toEqual(consolidatedProgress);
  });

  it("return consolidatedProgressTwo when params are equal to consolidatedProgressTwo", () => {
    const consolidatedProgressOne = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      resources: ["Observation"],
      conversionType: "json",
    });
    const consolidatedProgressTwo = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      resources: [],
      conversionType: "pdf",
    });
    const consolidatedProgressThree = makeConsolidatedQueryProgress({
      ...defaultConsolidatedProgress,
      resources: ["Observation", "AllergyIntolerance", "Practitioner"],
      conversionType: "html",
    });

    const resp = getCurrentConsolidatedProgress(
      [consolidatedProgressOne, consolidatedProgressTwo, consolidatedProgressThree],
      {
        resources: consolidatedProgressTwo.resources,
        dateFrom: consolidatedProgressTwo.dateFrom,
        dateTo: consolidatedProgressTwo.dateTo,
        conversionType: consolidatedProgressTwo.conversionType,
      }
    );

    expect(resp).toEqual(consolidatedProgressTwo);
  });
});

describe("getIsSameResources", () => {
  it("return true when both arrays are empty", () => {
    const resp = getIsSameResources([], []);

    expect(resp).toBeTruthy();
  });

  it("return false when one of the arrays is empty", () => {
    const resp = getIsSameResources([], ["Observation"]);

    expect(resp).toBeFalsy();
  });

  it("return false when both arrays are not equal", () => {
    const resp = getIsSameResources(["Observation"], ["AllergyIntolerance"]);

    expect(resp).toBeFalsy();
  });

  it("return true when both arrays are equal", () => {
    const resp = getIsSameResources(
      ["Observation", "AllergyIntolerance"],
      ["AllergyIntolerance", "Observation"]
    );

    expect(resp).toBeTruthy();
  });

  it("return true when first array is empty and the other is resourcesSearchableByPatient", () => {
    const resp = getIsSameResources([], [...resourcesSearchableByPatient]);

    expect(resp).toBeTruthy();
  });

  it("return true when second array is empty and the other is resourcesSearchableByPatient", () => {
    const resp = getIsSameResources([...resourcesSearchableByPatient], []);

    expect(resp).toBeTruthy();
  });
});
