/* eslint-disable @typescript-eslint/no-empty-function */
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientDataCommonwell } from "../../commonwell/patient-shared";
import { schedulePatientDiscovery, ScheduledPatientDiscovery } from "../schedule-patient-discovery";
import { resetPatientScheduledPatientDiscoveryRequestId } from "../reset-scheduled-patient-discovery-request";
import { getCqOrgIdsToDenyOnCw } from "../cross-hie-ids";

let patient: Patient;
let patientModel: PatientModel;

let patientModel_findOne: jest.SpyInstance;
let patientModel_update: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel = patient as unknown as PatientModel;
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
  patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
});

afterEach(() => {
  jest.clearAllMocks();
});

const checkPatientUpdateWith = (scheduledPd: ScheduledPatientDiscovery | undefined) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        externalData: expect.objectContaining({
          COMMONWELL: expect.objectContaining({
            scheduledPdRequest: scheduledPd ? expect.objectContaining(scheduledPd) : undefined,
          }),
        }),
      }),
    }),
    expect.anything()
  );
};

describe("update patient discovery schedule", () => {
  const newParams = {
    requestId: "new",
    source: MedicalDataSource.COMMONWELL,
    facilityId: "new",
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    rerunPdOnNewDemographics: false,
    forceCommonwell: undefined,
    forceCarequality: undefined,
  };
  it("update patient with no existing schedule", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    await schedulePatientDiscovery({
      ...newParams,
      patient,
    });
    checkPatientUpdateWith({
      requestId: newParams.requestId,
      facilityId: newParams.facilityId,
      getOrgIdExcludeList: newParams.getOrgIdExcludeList,
      rerunPdOnNewDemographics: newParams.rerunPdOnNewDemographics,
      forceCommonwell: newParams.forceCommonwell,
      forceCarequality: newParams.forceCarequality,
    });
  });
  it("update patient with existing schedule", async () => {
    const existingCwExternalData: PatientDataCommonwell = {
      patientId: "base",
      scheduledPdRequest: {
        requestId: "existing",
        facilityId: "existing",
        getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
        rerunPdOnNewDemographics: true,
        forceCommonwell: false,
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingCwExternalData,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    await schedulePatientDiscovery({
      ...newParams,
      patient,
    });
    checkPatientUpdateWith({
      requestId: newParams.requestId,
      facilityId: newParams.facilityId,
      getOrgIdExcludeList: newParams.getOrgIdExcludeList,
      rerunPdOnNewDemographics: newParams.rerunPdOnNewDemographics,
      forceCommonwell: newParams.forceCommonwell,
      forceCarequality: newParams.forceCarequality,
    });
  });
});

describe("reset patient discovery schedule", () => {
  it("reset patient with no existing schedule", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    await resetPatientScheduledPatientDiscoveryRequestId({
      patient,
      source: MedicalDataSource.COMMONWELL,
    });
    checkPatientUpdateWith(undefined);
  });
  it("reset patient with existing schedule", async () => {
    const existingCwExternalData: PatientDataCommonwell = {
      patientId: "base",
      scheduledPdRequest: {
        requestId: "existing",
        facilityId: "existing",
        getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
        rerunPdOnNewDemographics: true,
        forceCommonwell: false,
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingCwExternalData,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    await resetPatientScheduledPatientDiscoveryRequestId({
      patient,
      source: MedicalDataSource.COMMONWELL,
    });
    checkPatientUpdateWith(undefined);
  });
});
