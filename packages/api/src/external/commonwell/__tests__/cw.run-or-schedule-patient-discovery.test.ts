/* eslint-disable @typescript-eslint/no-empty-function */
import { MedicalDataSource } from "@metriport/core/external/index";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import * as cwPatient from "../patient";
import * as schedulePatientDiscovery from "../../hie/schedule-patient-discovery";
import { runOrScheduleCwPatientDiscovery } from "../command/run-or-schedule-patient-discovery";
import { PatientDataCommonwell } from "../patient-shared";
import { ScheduledPatientDiscovery } from "../../hie/schedule-patient-discovery";
import { getCqOrgIdsToDenyOnCw } from "../../hie/cross-hie-ids";

let patientModel: PatientModel;
let patientModel_findOne: jest.SpyInstance;
let cwUpdate_mock: jest.SpyInstance;
let schedulePatientDiscovery_mock: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
  cwUpdate_mock = jest.spyOn(cwPatient, "update").mockImplementation(async () => {
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
  const baseCqExternalData: PatientDataCommonwell = {
    patientId: "base",
    discoveryRequestId: "base",
    discoveryFacilityId: "base",
    discoveryStartedAt: new Date(),
    discoveryRerunPdOnNewDemographics: false,
  };
  it("runs with previous patient discovery completed", async () => {
    const status = "completed";
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: {
          ...{
            ...baseCqExternalData,
            status,
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
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      rerunPdOnNewDemographics: undefined,
      forceCommonwell: undefined,
    };
    await runOrScheduleCwPatientDiscovery(params);
    expect(cwUpdate_mock).toBeCalledWith(params);
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
  it("runs with previous patient discovery failed", async () => {
    const status = "failed";
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: {
          ...{
            ...baseCqExternalData,
            status,
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
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      rerunPdOnNewDemographics: undefined,
      forceCommonwell: undefined,
    };
    await runOrScheduleCwPatientDiscovery(params);
    expect(cwUpdate_mock).toBeCalledWith(params);
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
  it("runs with previous patient discovery processsing and no schedule", async () => {
    const status = "processing";
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: {
          ...{
            ...baseCqExternalData,
            status,
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
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      rerunPdOnNewDemographics: undefined,
      forceCommonwell: undefined,
    };
    await runOrScheduleCwPatientDiscovery(params);
    expect(cwUpdate_mock).not.toBeCalled();
    expect(schedulePatientDiscovery_mock).toBeCalledWith({
      ...params,
      source: MedicalDataSource.COMMONWELL,
    });
  });
  it("runs with previous patient discovery processsing and schedule", async () => {
    const scheduledPd: ScheduledPatientDiscovery = {
      requestId: "scheduled",
      facilityId: "scheduled",
      rerunPdOnNewDemographics: undefined,
    };
    const status = "processing";
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: {
          ...{
            ...baseCqExternalData,
            status,
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
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      rerunPdOnNewDemographics: undefined,
      forceCommonwell: undefined,
    };
    await runOrScheduleCwPatientDiscovery(params);
    expect(cwUpdate_mock).not.toBeCalled();
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
});
