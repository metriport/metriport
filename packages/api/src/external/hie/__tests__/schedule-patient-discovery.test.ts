/* eslint-disable @typescript-eslint/no-empty-function */
import { ScheduledPatientDiscovery } from "@metriport/core/domain/patient-discovery";
import { PatientModel } from "../../../models/medical/patient";
import { CQDirectoryEntryModel } from "../../carequality/models/cq-directory";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientDataCommonwell } from "../../commonwell/patient-shared";
import { schedulePatientDiscovery } from "../schedule-patient-discovery";
import { resetScheduledPatientDiscovery } from "../reset-scheduled-patient-discovery-request";
import { getCqOrgIdsToDenyOnCw } from "../cross-hie-ids";

let patientModel_findOne: jest.SpyInstance;
let patientModel_update: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne");
  patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
  jest.spyOn(CQDirectoryEntryModel, "findAll").mockImplementation(async () => []);
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
  it("update patient with no existing schedule", async () => {
    const newParams = {
      requestId: "new",
      facilityId: "new",
      orgIdExcludeList: await getCqOrgIdsToDenyOnCw(),
      rerunPdOnNewDemographics: false,
      forceCommonwell: undefined,
      forceCarequality: undefined,
    };
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    await schedulePatientDiscovery({
      patient,
      source: MedicalDataSource.COMMONWELL,
      ...newParams,
    });
    checkPatientUpdateWith(newParams);
  });
  it("update patient with existing schedule", async () => {
    const newParams = {
      requestId: "new",
      facilityId: "new",
      orgIdExcludeList: await getCqOrgIdsToDenyOnCw(),
      rerunPdOnNewDemographics: false,
      forceCommonwell: undefined,
      forceCarequality: undefined,
    };
    const existingParams: PatientDataCommonwell = {
      patientId: "existing",
      scheduledPdRequest: {
        requestId: "existing",
        facilityId: "existing",
        orgIdExcludeList: await getCqOrgIdsToDenyOnCw(),
        rerunPdOnNewDemographics: true,
        forceCommonwell: false,
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingParams,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    await schedulePatientDiscovery({
      patient,
      source: MedicalDataSource.COMMONWELL,
      ...newParams,
    });
    checkPatientUpdateWith(newParams);
  });
});

describe("reset patient discovery schedule", () => {
  it("reset patient with no existing schedule", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    await resetScheduledPatientDiscovery({
      patient,
      source: MedicalDataSource.COMMONWELL,
    });
    checkPatientUpdateWith(undefined);
  });
  it("reset patient with existing schedule", async () => {
    const existingParams: PatientDataCommonwell = {
      patientId: "base",
      scheduledPdRequest: {
        requestId: "existing",
        facilityId: "existing",
        orgIdExcludeList: await getCqOrgIdsToDenyOnCw(),
        rerunPdOnNewDemographics: true,
        forceCommonwell: false,
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingParams,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    await resetScheduledPatientDiscovery({
      patient,
      source: MedicalDataSource.COMMONWELL,
    });
    checkPatientUpdateWith(undefined);
  });
});
