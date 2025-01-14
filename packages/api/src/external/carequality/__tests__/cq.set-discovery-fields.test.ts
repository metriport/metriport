import { DiscoveryParams } from "@metriport/core/domain/patient-discovery";
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { LinkStatus } from "../../patient-link";
import { updatePatientDiscoveryStatus } from "../command/update-patient-discovery-status";

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

type cqParams = {
  discoveryStatus?: LinkStatus;
  params?: {
    requestId: string;
    facilityId: string;
    startedAt: Date;
    rerunPdOnNewDemographics: boolean;
  };
};

const checkPatientUpdateWith = (newValues: cqParams) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        externalData: expect.objectContaining({
          CAREQUALITY: expect.objectContaining({
            discoveryStatus: newValues.discoveryStatus,
            ...(newValues.params && { discoveryParams: newValues.params }),
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
    const discoveryStatus = "processing";
    const newParams: DiscoveryParams = {
      requestId: "test",
      facilityId: "test",
      startedAt: new Date(),
      rerunPdOnNewDemographics: false,
    };
    const results = await updatePatientDiscoveryStatus({
      patient,
      status: discoveryStatus,
      params: newParams,
    });
    expect(results).toBeTruthy();
    checkPatientUpdateWith({
      discoveryStatus,
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
        CAREQUALITY: {
          ...{
            discoveryStatus: "processing",
          },
          discoveryParams: baseParams,
        },
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValue(patient);
    const discoveryStatus = "completed";
    const results = await updatePatientDiscoveryStatus({
      patient,
      status: discoveryStatus,
    });
    expect(results).toBeTruthy();
    checkPatientUpdateWith({
      discoveryStatus,
      params: baseParams,
    });
  });
  it("setting only status w/ no previous values", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValue(patient);
    const discoveryStatus = "completed";
    try {
      await updatePatientDiscoveryStatus({
        patient,
        status: discoveryStatus,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      expect(error.message).toBe(
        `Cannot update discovery status before assigning discovery params @ CQ`
      );
    }
  });
});
