import { Patient } from "@metriport/core/domain/patient";
import { updatePatientDiscoveryStatus } from "../command/update-patient-discovery-status";
import { PatientModel } from "../../../models/medical/patient";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientDataCarequality } from "../patient-shared";
import { LinkStatus } from "../../patient-link";

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
  jest.restoreAllMocks();
});

type cqParams = {
  discoveryStatus?: LinkStatus;
  discoveryRequestId?: string;
  discoveryFacilityId?: string;
  discoveryStartedAt?: Date;
  discoveryRerunPdOnNewDemographics?: boolean;
};

const checkPatientUpdateWith = (newValues?: cqParams) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        externalData: expect.objectContaining({
          CAREQUALITY: expect.objectContaining({
            ...newValues,
          }),
        }),
      }),
    }),
    expect.anything()
  );
};

describe("updatePatientDiscoveryStatus", () => {
  it("setting all possible values", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValue(patient);
    const discoveryStatus = "processing" as LinkStatus;
    const newValues = {
      discoveryRequestId: "test",
      discoveryFacilityId: "test",
      discoveryStartedAt: new Date(),
      discoveryRerunPdOnNewDemographics: false,
    };
    const resultIds = await updatePatientDiscoveryStatus({
      patient,
      ...newValues,
      status: discoveryStatus,
    });
    expect(resultIds).toBeTruthy();
    checkPatientUpdateWith({
      ...newValues,
      discoveryStatus,
    });
  });
  it("setting only status w/ previous values", async () => {
    const baseCqExternalData: PatientDataCarequality = {
      discoveryStatus: "processing",
      discoveryRequestId: "base",
      discoveryFacilityId: "base",
      discoveryStartedAt: new Date(),
      discoveryRerunPdOnNewDemographics: false,
    };
    const patientData = makePatientData({
      externalData: {
        CAREQUALITY: baseCqExternalData,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValue(patient);
    const discoveryStatus = "completed" as LinkStatus;
    const resultIds = await updatePatientDiscoveryStatus({
      patient,
      status: discoveryStatus,
    });
    expect(resultIds).toBeTruthy();
    checkPatientUpdateWith({
      ...baseCqExternalData,
      discoveryStatus,
    });
  });
  it("setting only status w/ no previous values", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValue(patient);
    const discoveryStatus = "completed" as LinkStatus;
    const resultIds = await updatePatientDiscoveryStatus({
      patient,
      status: discoveryStatus,
    });
    expect(resultIds).toBeTruthy();
    checkPatientUpdateWith({
      discoveryStatus,
    });
  });
});
