/* eslint-disable @typescript-eslint/no-empty-function */
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import * as cqPatient from "../../../external/carequality/command/run-or-schedule-patient-discovery";
import * as cwPatient from "../../../external/commonwell/command/run-or-schedule-patient-discovery";
import { runOrSchedulePatientDiscoveryAcrossHies } from "../run-or-schedule-patient-discovery";
import { getCqOrgIdsToDenyOnCw } from "../cross-hie-ids";

let patientModel: PatientModel;
let patientModel_findOne: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
});

const cqRunOrSchedule_mock = jest
  .spyOn(cqPatient, "runOrScheduleCqPatientDiscovery")
  .mockImplementation(async () => {
    return;
  });

const cwRunOrSchedule_mock = jest
  .spyOn(cwPatient, "runOrScheduleCwPatientDiscovery")
  .mockImplementation(async () => {
    return;
  });

describe("run initial patient discovery", () => {
  const mockedPatient = makePatient();
  const baseParams = {
    patient: mockedPatient,
    facilityId: "test",
    requestId: "test",
  };
  it("runs initial patient discovery with flags undefineds", async () => {
    patientModel_findOne.mockResolvedValueOnce(mockedPatient);
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
    expect(cqRunOrSchedule_mock).toHaveBeenCalledWith({
      ...sharedParams,
      forceCarequality,
    });
    expect(cwRunOrSchedule_mock).toHaveBeenCalledWith({
      ...sharedParams,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      forceCommonwell,
    });
  });
  it("runs initial patient discovery with flags defined false", async () => {
    patientModel_findOne.mockResolvedValueOnce(mockedPatient);
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
    expect(cqRunOrSchedule_mock).toHaveBeenCalledWith({
      ...sharedParams,
      forceCarequality,
    });
    expect(cwRunOrSchedule_mock).toHaveBeenCalledWith({
      ...sharedParams,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      forceCommonwell,
    });
  });
  it("runs initial patient discovery with flags defined true", async () => {
    patientModel_findOne.mockResolvedValueOnce(mockedPatient);
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
    expect(cqRunOrSchedule_mock).toHaveBeenCalledWith({
      ...sharedParams,
      forceCarequality,
    });
    expect(cwRunOrSchedule_mock).toHaveBeenCalledWith({
      ...sharedParams,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      forceCommonwell,
    });
  });
});
