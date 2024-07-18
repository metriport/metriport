/* eslint-disable @typescript-eslint/no-empty-function */
import { MedicalDataSource } from "@metriport/core/external/index";
import {
  DiscoveryParams,
  ScheduledPatientDiscovery,
} from "@metriport/core/domain/patient-discovery";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import * as cqPatient from "../patient";
import * as schedulePatientDiscovery from "../../hie/schedule-patient-discovery";
import { runOrScheduleCqPatientDiscovery } from "../command/run-or-schedule-patient-discovery";

let patientModel_findOne: jest.SpyInstance;
let cqDiscover_mock: jest.SpyInstance;
let schedulePatientDiscovery_mock: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne");
  cqDiscover_mock = jest.spyOn(cqPatient, "discover").mockImplementation(async () => {
    return;
  });
  schedulePatientDiscovery_mock = jest
    .spyOn(schedulePatientDiscovery, "schedulePatientDiscovery")
    .mockImplementation(async () => {
      return;
    });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("run or schedule patient discovery", () => {
  it("runs with no previous patient discovery", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    const params = {
      patient,
      facilityId: "toRun",
      requestId: "toRun",
      rerunPdOnNewDemographics: undefined,
      forceCarequality: undefined,
    };
    await runOrScheduleCqPatientDiscovery(params);
    expect(cqDiscover_mock).toBeCalledWith(params);
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
  const baseDiscoveryParams: DiscoveryParams = {
    requestId: "base",
    facilityId: "base",
    startedAt: new Date(),
    rerunPdOnNewDemographics: false,
  };
  it("runs with previous patient discovery completed", async () => {
    const discoveryStatus = "completed";
    const patientData = makePatientData({
      externalData: {
        CAREQUALITY: {
          ...{
            discoveryStatus,
          },
          discoveryParams: baseDiscoveryParams,
        },
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const params = {
      patient,
      facilityId: "toRun",
      requestId: "toRun",
      rerunPdOnNewDemographics: undefined,
      forceCarequality: undefined,
    };
    await runOrScheduleCqPatientDiscovery(params);
    expect(cqDiscover_mock).toBeCalledWith(params);
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
  it("runs with previous patient discovery failed", async () => {
    const discoveryStatus = "failed";
    const patientData = makePatientData({
      externalData: {
        CAREQUALITY: {
          ...{
            discoveryStatus,
          },
          discoveryParams: baseDiscoveryParams,
        },
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const params = {
      patient,
      facilityId: "toRun",
      requestId: "toRun",
      rerunPdOnNewDemographics: undefined,
      forceCarequality: undefined,
    };
    await runOrScheduleCqPatientDiscovery(params);
    expect(cqDiscover_mock).toBeCalledWith(params);
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
  it("runs with previous patient discovery processsing and no schedule", async () => {
    const discoveryStatus = "processing";
    const patientData = makePatientData({
      externalData: {
        CAREQUALITY: {
          ...{
            discoveryStatus,
          },
          discoveryParams: baseDiscoveryParams,
        },
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const params = {
      patient,
      facilityId: "toBeScheduled",
      requestId: "toBeScheduled",
      rerunPdOnNewDemographics: undefined,
      forceCarequality: undefined,
    };
    await runOrScheduleCqPatientDiscovery(params);
    expect(cqDiscover_mock).not.toBeCalled();
    expect(schedulePatientDiscovery_mock).toBeCalledWith({
      ...params,
      source: MedicalDataSource.CAREQUALITY,
    });
  });
  it("runs with previous patient discovery processsing and schedule", async () => {
    const scheduledPd: ScheduledPatientDiscovery = {
      requestId: "scheduled",
      facilityId: "scheduled",
      rerunPdOnNewDemographics: undefined,
    };
    const discoveryStatus = "processing";
    const patientData = makePatientData({
      externalData: {
        CAREQUALITY: {
          ...{
            ...{
              discoveryStatus,
            },
            discoveryParams: baseDiscoveryParams,
            scheduledPdRequest: scheduledPd,
          },
        },
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const params = {
      patient,
      facilityId: "toNotSchedule",
      requestId: "toNotSchedule",
      rerunPdOnNewDemographics: undefined,
      forceCarequality: undefined,
    };
    await runOrScheduleCqPatientDiscovery(params);
    expect(cqDiscover_mock).not.toBeCalled();
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
});
