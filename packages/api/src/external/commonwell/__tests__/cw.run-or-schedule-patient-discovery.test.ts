/* eslint-disable @typescript-eslint/no-empty-function */
import { MedicalDataSource } from "@metriport/core/external/index";
import {
  DiscoveryParams,
  ScheduledPatientDiscovery,
} from "@metriport/core/domain/patient-discovery";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { CQDirectoryEntryModel } from "../../carequality/models/cq-directory";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import * as cwPatient from "../patient";
import * as schedulePatientDiscovery from "../../hie/schedule-patient-discovery";
import { runOrScheduleCwPatientDiscovery } from "../command/run-or-schedule-patient-discovery";
import { getCqOrgIdsToDenyOnCw } from "../../hie/cross-hie-ids";

let patientModel: PatientModel;
let patientModel_findOne: jest.SpyInstance;
let cwUpdate_mock: jest.SpyInstance;
let schedulePatientDiscovery_mock: jest.SpyInstance;
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
let directoryModel_findAll: jest.SpyInstance;

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
  directoryModel_findAll = jest
    .spyOn(CQDirectoryEntryModel, "findAll")
    .mockImplementation(async () => []);
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
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      rerunPdOnNewDemographics: undefined,
      forceCommonwell: undefined,
    };
    await runOrScheduleCwPatientDiscovery(params);
    expect(cwUpdate_mock).toBeCalledWith(params);
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
  const baseDiscoveryParams: DiscoveryParams = {
    requestId: "base",
    facilityId: "base",
    startedAt: new Date(),
    rerunPdOnNewDemographics: false,
  };
  it("runs with previous patient discovery completed", async () => {
    const status = "completed";
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: {
          ...{
            status,
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
            status,
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
            status,
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
      forceCommonwell: undefined,
    };
    await runOrScheduleCwPatientDiscovery({
      ...params,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    });
    expect(cwUpdate_mock).not.toBeCalled();
    expect(schedulePatientDiscovery_mock).toBeCalledWith({
      ...params,
      orgIdExcludeList: await getCqOrgIdsToDenyOnCw(),
      source: MedicalDataSource.COMMONWELL,
    });
  });
  it("runs with previous patient discovery processsing and schedule", async () => {
    const scheduledPd: ScheduledPatientDiscovery = {
      requestId: "scheduled",
      facilityId: "scheduled",
      orgIdExcludeList: [],
      rerunPdOnNewDemographics: undefined,
      forceCommonwell: undefined,
    };
    const status = "processing";
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: {
          ...{
            ...{
              status,
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
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      rerunPdOnNewDemographics: undefined,
      forceCommonwell: undefined,
    };
    await runOrScheduleCwPatientDiscovery(params);
    expect(cwUpdate_mock).not.toBeCalled();
    expect(schedulePatientDiscovery_mock).not.toBeCalled();
  });
});
