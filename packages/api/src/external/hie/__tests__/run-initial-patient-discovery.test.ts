/* eslint-disable @typescript-eslint/no-empty-function */
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import * as cqPatient from "../../../external/carequality/patient";
import * as cwPatient from "../../../external/commonwell/patient";
import { runInitialPatientDiscoveryAcrossHies } from "../run-initial-patient-discovery";
import { getCqOrgIdsToDenyOnCw } from "../cross-hie-ids";

let patientModel: PatientModel;
let patientModel_findOne: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
});

const cqDiscoer_mock = jest.spyOn(cqPatient, "discover").mockImplementation(async () => {
  return;
});

const cwCreate_mock = jest.spyOn(cwPatient, "create").mockImplementation(async () => {
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
    await runInitialPatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqDiscoer_mock).toHaveBeenCalledWith({
      ...sharedParams,
      forceEnabled: forceCarequality,
    });
    expect(cwCreate_mock).toHaveBeenCalledWith({
      ...sharedParams,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      forceCWCreate: forceCommonwell,
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
    await runInitialPatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqDiscoer_mock).toHaveBeenCalledWith({
      ...sharedParams,
      forceEnabled: forceCarequality,
    });
    expect(cwCreate_mock).toHaveBeenCalledWith({
      ...sharedParams,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      forceCWCreate: forceCommonwell,
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
    await runInitialPatientDiscoveryAcrossHies({
      ...sharedParams,
      forceCarequality,
      forceCommonwell,
    });
    expect(cqDiscoer_mock).toHaveBeenCalledWith({
      ...sharedParams,
      forceEnabled: forceCarequality,
    });
    expect(cwCreate_mock).toHaveBeenCalledWith({
      ...sharedParams,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      forceCWCreate: forceCommonwell,
    });
  });
});
