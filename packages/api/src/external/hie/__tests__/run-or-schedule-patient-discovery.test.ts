/* eslint-disable @typescript-eslint/no-empty-function */
import { makePatient } from "@metriport/core/domain/__tests__/patient";
import * as cqRunSchedule from "../../../external/carequality/command/run-or-schedule-patient-discovery";
import * as cqPatient from "../../../external/carequality/patient";
import * as cwRunOrSchedule from "../../../external/commonwell-v1/command/run-or-schedule-patient-discovery";
import * as cwPatient from "../../../external/commonwell-v1/patient";
import { PatientModel } from "../../../models/medical/patient";
import { PatientMappingModel } from "../../../models/patient-mapping";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { runInitialPatientDiscoveryAcrossHies } from "../run-initial-patient-discovery";
import { runOrSchedulePatientDiscoveryAcrossHies } from "../run-or-schedule-patient-discovery";

let patientModel_findOne: jest.SpyInstance;
let cqDiscover_mock: jest.SpyInstance;
let cwCreate_mock: jest.SpyInstance;
let cqRunOrSchedule_mock: jest.SpyInstance;
let cwRunOrSchedule_mock: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne");
  jest.spyOn(PatientMappingModel, "findAll").mockResolvedValue([]);
  cqDiscover_mock = jest.spyOn(cqPatient, "discover").mockImplementation(async () => {
    return;
  });
  cwCreate_mock = jest.spyOn(cwPatient, "create").mockImplementation(async () => {
    return;
  });
  cqRunOrSchedule_mock = jest
    .spyOn(cqRunSchedule, "runOrScheduleCqPatientDiscovery")
    .mockImplementation(async () => {
      return;
    });
  cwRunOrSchedule_mock = jest
    .spyOn(cwRunOrSchedule, "runOrScheduleCwPatientDiscovery")
    .mockImplementation(async () => {
      return;
    });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("run initial patient discovery", () => {
  const patient = makePatient();
  const baseParams = {
    patient,
    facilityId: "test",
  };
  it("runs initial patient discovery with flags undefineds", async () => {
    patientModel_findOne.mockResolvedValueOnce({ dataValues: patient });
    const sharedParams = {
      ...baseParams,
      rerunPdOnNewDemographics: undefined,
    };
    const forceCarequality = undefined;
    const forceCommonwell = undefined;
    await runInitialPatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqDiscover_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        forceEnabled: forceCarequality,
      })
    );
    expect(cwCreate_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        getOrgIdExcludeList: expect.any(Function),
        forceCWCreate: forceCommonwell,
      })
    );
  });
  it("runs initial patient discovery with flags defined false", async () => {
    patientModel_findOne.mockResolvedValueOnce({ dataValues: patient });
    const sharedParams = {
      ...baseParams,
      rerunPdOnNewDemographics: false,
    };
    const forceCarequality = false;
    const forceCommonwell = false;
    await runInitialPatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqDiscover_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        forceEnabled: forceCarequality,
      })
    );
    expect(cwCreate_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        getOrgIdExcludeList: expect.any(Function),
        forceCWCreate: forceCommonwell,
      })
    );
  });
  it("runs initial patient discovery with flags defined true", async () => {
    patientModel_findOne.mockResolvedValueOnce({ dataValues: patient });
    const sharedParams = {
      ...baseParams,
      rerunPdOnNewDemographics: true,
    };
    const forceCarequality = true;
    const forceCommonwell = true;
    await runInitialPatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqDiscover_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        forceEnabled: forceCarequality,
      })
    );
    expect(cwCreate_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        getOrgIdExcludeList: expect.any(Function),
        forceCWCreate: forceCommonwell,
      })
    );
  });
});

describe("run initial patient discovery", () => {
  const patient = makePatient();
  const baseParams = {
    patient: patient,
    facilityId: "test",
  };
  it("runs initial patient discovery with flags undefineds", async () => {
    patientModel_findOne.mockResolvedValueOnce({ dataValues: patient });
    const sharedParams = {
      ...baseParams,
      rerunPdOnNewDemographics: undefined,
    };
    const forceCarequality = undefined;
    const forceCommonwell = undefined;
    await runOrSchedulePatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqRunOrSchedule_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        forceCarequality,
      })
    );
    expect(cwRunOrSchedule_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        getOrgIdExcludeList: expect.any(Function),
        forceCommonwell,
      })
    );
  });
  it("runs initial patient discovery with flags defined false", async () => {
    patientModel_findOne.mockResolvedValueOnce({ dataValues: patient });
    const sharedParams = {
      ...baseParams,
      rerunPdOnNewDemographics: false,
    };
    const forceCarequality = false;
    const forceCommonwell = false;
    await runOrSchedulePatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqRunOrSchedule_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        forceCarequality,
      })
    );
    expect(cwRunOrSchedule_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        getOrgIdExcludeList: expect.any(Function),
        forceCommonwell,
      })
    );
  });
  it("runs initial patient discovery with flags defined true", async () => {
    patientModel_findOne.mockResolvedValueOnce({ dataValues: patient });
    const sharedParams = {
      ...baseParams,
      rerunPdOnNewDemographics: true,
    };
    const forceCarequality = true;
    const forceCommonwell = true;
    await runOrSchedulePatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqRunOrSchedule_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        forceCarequality,
      })
    );
    expect(cwRunOrSchedule_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...sharedParams,
        getOrgIdExcludeList: expect.any(Function),
        forceCommonwell,
      })
    );
  });
});
