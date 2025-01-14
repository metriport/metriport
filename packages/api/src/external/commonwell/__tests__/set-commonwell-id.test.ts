import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { CWParams, updateCommonwellIdsAndStatus } from "../patient-external-data";
import { PatientDataCommonwell } from "../patient-shared";

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

const checkPatientUpdateWith = (cwParams: Partial<CWParams>) => {
  expect(patientModel_update).toHaveBeenCalledWith(
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

    const result = await updateCommonwellIdsAndStatus({
      patient,
      ...newValues,
    });

    expect(result).toBeTruthy();
    checkPatientUpdateWith(newValues);
  });

  it("has CW externalData set to newValues when CW externalData has oldValues and we set newValues", async () => {
    const oldValues: PatientDataCommonwell = {
      patientId: "oldCommonwellPatientId",
      personId: "oldCommonwellPersonId",
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

    const newValues: CWParams = {
      commonwellPatientId: "newCommonwellPatientId",
      commonwellPersonId: "newCommonwellPersonId",
      cqLinkStatus: "linked",
    };

    const result = await updateCommonwellIdsAndStatus({
      patient,
      ...newValues,
    });

    expect(result).toBeTruthy();
    checkPatientUpdateWith(newValues);
  });

  it("has CW externalData set to newStatus + oldValues when CW externalData has oldValues and we set newStatus", async () => {
    const oldValues: PatientDataCommonwell = {
      patientId: "oldCommonwellPatientId",
      personId: "oldCommonwellPersonId",
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

    const newStatus: CWParams = {
      commonwellPatientId: "newCommonwellPatientId",
      commonwellPersonId: undefined,
      cqLinkStatus: undefined,
    };

    const result = await updateCommonwellIdsAndStatus({
      patient,
      ...newStatus,
    });

    expect(result).toBeTruthy();
    checkPatientUpdateWith({
      commonwellPatientId: newStatus.commonwellPatientId,
      commonwellPersonId: oldValues.personId,
      cqLinkStatus: oldValues.cqLinkStatus,
    });
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
