import { Patient } from "@metriport/core/domain/patient";
import {
  updateCommonwellIdsAndStatus,
  CWParams,
  updatePatientDiscoveryStatus,
} from "../patient-external-data";
import { PatientModel } from "../../../models/medical/patient";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientDataCommonwell } from "../patient-shared";
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

const checkPatientUpdateWith = (cwParams: Partial<CWParams>, status?: LinkStatus) => {
  expect(patientModel_update).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      data: expect.objectContaining({
        externalData: expect.objectContaining({
          COMMONWELL: expect.objectContaining({
            ...(cwParams.commonwellPatientId && { patientId: cwParams.commonwellPatientId }),
            ...(cwParams.commonwellPersonId && { personId: cwParams.commonwellPersonId }),
            ...(cwParams.cqLinkStatus && { cqLinkStatus: cwParams.cqLinkStatus }),
          }),
        }),
      }),
    }),
    expect.anything()
  );
  if (status) {
    expect(patientModel_update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          externalData: expect.objectContaining({
            COMMONWELL: expect.objectContaining({ status }),
          }),
        }),
      }),
      expect.anything()
    );
  }
};

describe("setCommonwellIdsAndStatus", () => {
  it("has CW externalData set to newValues when CW externalData is empty and we set newValues", async () => {
    const patient = makePatient();

    patientModel_findOne.mockResolvedValue(patient);

    const newValues: CWParams = {
      commonwellPatientId: "commonwellPatientId",
      commonwellPersonId: "commonwellPersonId",
      cqLinkStatus: "processing",
    };
    const status: LinkStatus = "processing";

    const resultIds = await updateCommonwellIdsAndStatus({ patient, ...newValues });
    expect(resultIds).toBeTruthy();

    const resultStatus = await updatePatientDiscoveryStatus({ patient, status });
    expect(resultStatus).toBeTruthy();

    checkPatientUpdateWith(newValues, status);
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

    patientModel_findOne.mockResolvedValue(patient);

    const newValues: CWParams = {
      commonwellPatientId: "newCommonwellPatientId",
      commonwellPersonId: "newCommonwellPersonId",
      cqLinkStatus: "linked",
    };
    const status: LinkStatus = "completed";

    const resultIds = await updateCommonwellIdsAndStatus({ patient, ...newValues });
    expect(resultIds).toBeTruthy();

    const resultStatus = await updatePatientDiscoveryStatus({ patient, status });
    expect(resultStatus).toBeTruthy();

    checkPatientUpdateWith(newValues, status);
  });

  it("has CW externalData set to newStatus + oldValues when CW externalData has oldValues and we set newStatus", async () => {
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

    patientModel_findOne.mockResolvedValue(patient);

    const newStatus: CWParams = {
      commonwellPatientId: "newCommonwellPatientId",
      commonwellPersonId: undefined,
      cqLinkStatus: undefined,
    };
    const status: LinkStatus = "completed";

    const result = await updateCommonwellIdsAndStatus({ patient, ...newStatus });
    expect(result).toBeTruthy();

    const resultStatus = await updatePatientDiscoveryStatus({ patient, status });
    expect(resultStatus).toBeTruthy();

    checkPatientUpdateWith(
      {
        commonwellPatientId: newStatus.commonwellPatientId,
        commonwellPersonId: oldValues.personId,
        cqLinkStatus: oldValues.cqLinkStatus,
      },
      status
    );
  });

  it("has CW externalData set to onlyPatientId & cqLinkStatus = unlinked when CW externalData is empty and we set onlyPatientId", async () => {
    const patient = makePatient();

    patientModel_findOne.mockResolvedValueOnce(patient);

    const onlyPatientId: CWParams = {
      commonwellPatientId: "newCommonwellPatientId",
      commonwellPersonId: undefined,
      cqLinkStatus: undefined,
    };

    const result = await updateCommonwellIdsAndStatus({ patient, ...onlyPatientId });
    expect(result).toBeTruthy();

    checkPatientUpdateWith({
      commonwellPatientId: onlyPatientId.commonwellPatientId,
      cqLinkStatus: "unlinked",
    });
  });
});
