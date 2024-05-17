import { Patient } from "@metriport/core/domain/patient";
import { updateCommonwellPatientAndPersonIds } from "../command/update-patient-and-person-ids";
import { updateCommenwellCqLinkStatus } from "../command/update-cq-link-status";
import { updatePatientDiscoveryStatus } from "../command/update-patient-discovery-status";
import { PatientModel } from "../../../models/medical/patient";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientDataCommonwell } from "../patient-shared";
import { CQLinkStatus } from "../patient-external-data";
import { LinkStatus } from "../../patient-link";

let patient: Patient;
let patientModel: PatientModel;

let patientModel_findOne: jest.SpyInstance;
let patientModel_update: jest.SpyInstance;

export type CWParams = {
  commonwellPatientId: string;
  commonwellPersonId: string | undefined;
  status: LinkStatus | undefined;
  cqLinkStatus: CQLinkStatus | undefined;
};

beforeEach(() => {
  mockStartTransaction();
  patientModel = patient as unknown as PatientModel;
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
  patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const checkPatientUpdateWith = (cwParams: Partial<CWParams>) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        externalData: expect.objectContaining({
          COMMONWELL: {
            ...(cwParams.commonwellPatientId && { patientId: cwParams.commonwellPatientId }),
            ...(cwParams.commonwellPersonId && { personId: cwParams.commonwellPersonId }),
            ...(cwParams.status && { status: cwParams.status }),
            ...(cwParams.cqLinkStatus && { cqLinkStatus: cwParams.cqLinkStatus }),
          },
        }),
      }),
    }),
    expect.anything()
  );
};

describe("setCommonwellIdsAndStatus", () => {
  it("has CW externalData set to newValues when CW externalData is empty and we set newValues", async () => {
    const patient = makePatient();

    patientModel_findOne.mockResolvedValueOnce(patient);

    const newValues = {
      commonwellPatientId: "commonwellPatientId",
      commonwellPersonId: "commonwellPersonId",
      cqLinkStatus: "processing" as CQLinkStatus,
      status: "processing" as LinkStatus,
    };

    const resultIds = await updateCommonwellPatientAndPersonIds({
      patient,
      ...newValues,
    });
    expect(resultIds).toBeTruthy();

    const resultCqLinkStatus = await updateCommenwellCqLinkStatus({
      patient,
      ...newValues,
    });
    expect(resultCqLinkStatus).toBeTruthy();

    const resultPdStatus = await updatePatientDiscoveryStatus({
      patient,
      ...newValues,
    });
    expect(resultPdStatus).toBeTruthy();

    checkPatientUpdateWith(newValues);
  });

  it("has CW externalData set to newValues when CW externalData has oldValues and we set newValues", async () => {
    const oldValues: PatientDataCommonwell = {
      patientId: "oldCommonwellPatientId",
      personId: "oldCommonwellPersonId",
      status: "processing",
      cqLinkStatus: "processing",
    };

    const patient = makePatient({
      data: makePatientData({
        externalData: {
          COMMONWELL: {
            ...oldValues,
          },
        },
      }),
    });

    patientModel_findOne.mockResolvedValueOnce(patient);

    const newValues = {
      commonwellPatientId: "newCommonwellPatientId",
      commonwellPersonId: "newCommonwellPersonId",
      cqLinkStatus: "linked" as CQLinkStatus,
      status: "completed" as LinkStatus,
    };

    const resultIds = await updateCommonwellPatientAndPersonIds({
      patient,
      ...newValues,
    });
    expect(resultIds).toBeTruthy();

    const resultCqLinkStatus = await updateCommenwellCqLinkStatus({
      patient,
      ...newValues,
    });
    expect(resultCqLinkStatus).toBeTruthy();

    const resultPdStatus = await updatePatientDiscoveryStatus({
      patient,
      ...newValues,
    });
    expect(resultPdStatus).toBeTruthy();

    checkPatientUpdateWith(newValues);
  });
});
