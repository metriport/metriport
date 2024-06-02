/* eslint-disable @typescript-eslint/no-empty-function */
import { MedicalDataSource } from "@metriport/core/external/index";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import * as cqPatient from "../patient";
import * as schedulePatientDiscovery from "../../hie/schedule-patient-discovery";
import { runOrScheduleCqPatientDiscovery } from "../command/run-or-schedule-patient-discovery";
import { PatientDataCarequality } from "../patient-shared";
import { ScheduledPatientDiscovery } from "../../hie/schedule-patient-discovery";

let patientModel: PatientModel;
let patientModel_findOne: jest.SpyInstance;
let cqDiscover_mock: jest.SpyInstance;
let schedulePatientDiscovery_mock: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
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
  const baseCqExternalData: PatientDataCarequality = {
    discoveryRequestId: "base",
    discoveryFacilityId: "base",
    discoveryStartedAt: new Date(),
    discoveryRerunPdOnNewDemographics: false,
  };
  it("runs with previous patient discovery completed", async () => {
    const discoveryStatus = "completed";
    const patientData = makePatientData({
      externalData: {
        CAREQUALITY: {
          ...{
            ...baseCqExternalData,
            discoveryStatus,
          },
        },
      },
    });
    const mockedPatient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(mockedPatient);
    const params = {
      patient: mockedPatient,
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
            ...baseCqExternalData,
            discoveryStatus,
          },
        },
      },
    });
    const mockedPatient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(mockedPatient);
    const params = {
      patient: mockedPatient,
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
            ...baseCqExternalData,
            discoveryStatus,
          },
        },
      },
    });
    const mockedPatient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(mockedPatient);
    const params = {
      patient: mockedPatient,
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
            ...baseCqExternalData,
            discoveryStatus,
            scheduledPdRequest: scheduledPd,
          },
        },
      },
    });
    const mockedPatient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(mockedPatient);
    const params = {
      patient: mockedPatient,
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
