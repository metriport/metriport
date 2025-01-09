import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { DiscoveryParams } from "@metriport/core/domain/patient-discovery";
import { MedicalDataSource } from "@metriport/core/external/index";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientModel } from "../../../models/medical/patient";
import { LinkStatus } from "../../patient-link";
import { updatePatientDiscoveryStatus } from "../update-patient-discovery-status";

let patientModel_findOne: jest.SpyInstance;
let patientModel_update: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne");
  patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

type cwParams = {
  status?: LinkStatus;
  params?: {
    requestId: string;
    facilityId: string;
    startedAt: Date;
    rerunPdOnNewDemographics: boolean;
  };
};

const checkPatientUpdateWith = (newParams: cwParams) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        externalData: expect.objectContaining({
          COMMONWELL: expect.objectContaining({
            status: newParams.status,
            ...(newParams.params && { discoveryParams: newParams.params }),
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
    const status = "processing";
    const newParams: DiscoveryParams = {
      requestId: "test",
      facilityId: "test",
      startedAt: new Date(),
      rerunPdOnNewDemographics: false,
    };
    const results = await updatePatientDiscoveryStatus({
      patient,
      status: status,
      params: newParams,
      source: MedicalDataSource.COMMONWELL,
    });
    expect(results).toBeTruthy();
    checkPatientUpdateWith({
      status,
      params: newParams,
    });
  });
  it("setting only status w/ previous values", async () => {
    const baseParams: DiscoveryParams = {
      requestId: "base",
      facilityId: "base",
      startedAt: new Date(),
      rerunPdOnNewDemographics: false,
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: {
          ...{
            status: "processing",
          },
          discoveryParams: baseParams,
        },
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValue(patient);
    const status = "completed";
    const results = await updatePatientDiscoveryStatus({
      patient,
      status,
      source: MedicalDataSource.COMMONWELL,
    });
    expect(results).toBeTruthy();
    checkPatientUpdateWith({
      status,
      params: baseParams,
    });
  });
  it("setting only status w/ no previous values", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValue(patient);
    const status = "completed";
    try {
      await updatePatientDiscoveryStatus({
        patient,
        status,
        source: MedicalDataSource.COMMONWELL,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      expect(error.message).toBe(
        `Cannot update discovery status before assigning discovery params`
      );
    }
  });
});
