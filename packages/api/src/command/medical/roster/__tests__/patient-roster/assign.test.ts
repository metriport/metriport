import { BadRequestError } from "@metriport/shared";
import { mockStartTransaction } from "../../../../../models/__tests__/transaction";
import { PatientRosterModel } from "../../../../../models/medical/patient-roster";
import * as getPatientIds from "../../../patient/get-patient-read-only";
import * as verifyPatients from "../../../patient/settings/common";
import * as getRoster from "../../get-roster";
import { assignPatientsToRoster } from "../../patient-roster/assign-patients-to-roster";
import { makeRosterModel } from "../make-roster";
import { makePatientRosterModel, MakePatientRosterOverrides } from "./make-patient-roster";

jest.mock("../../../../../models/medical/patient-roster");
jest.mock("../../../patient/get-patient-read-only");
jest.mock("../../../patient/settings/common");
jest.mock("../../get-roster");

describe("assignPatientsToRoster", () => {
  let patientRosterModel_bulkCreate: jest.SpyInstance;
  let getRosterOrFail_mock: jest.SpyInstance;
  let getPatientIds_mock: jest.SpyInstance;
  let verifyPatients_mock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    getRosterOrFail_mock = jest.spyOn(getRoster, "getRosterOrFail");
    getPatientIds_mock = jest.spyOn(getPatientIds, "getPatientIds");
    verifyPatients_mock = jest.spyOn(verifyPatients, "verifyPatients");
    patientRosterModel_bulkCreate = jest
      .spyOn(PatientRosterModel, "bulkCreate")
      .mockImplementation(async (assignments: readonly unknown[]) => {
        return assignments.map((a: unknown) =>
          makePatientRosterModel(a as MakePatientRosterOverrides)
        );
      });
  });

  it("assigns specific patients to an open roster", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "patient2", "patient3"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    verifyPatients_mock.mockResolvedValue({
      validPatientIds: patientIds,
      invalidPatientIds: [],
    });

    const result = await assignPatientsToRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      patientIds,
    });

    expect(result).toBe(patientIds.length);
    expect(verifyPatients_mock).toHaveBeenCalledWith({
      patientIds,
      cxId: roster.cxId,
    });
    expect(patientRosterModel_bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining(
        patientIds.map(patientId =>
          expect.objectContaining({
            patientId,
            rosterId: roster.id,
          })
        )
      ),
      expect.objectContaining({
        ignoreDuplicates: true,
      })
    );
  });

  it("assigns all patients when all is true", async () => {
    const roster = makeRosterModel({ status: "open" });
    const allPatientIds = ["patient1", "patient2", "patient3"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    getPatientIds_mock.mockResolvedValue(allPatientIds);
    verifyPatients_mock.mockResolvedValue({
      validPatientIds: allPatientIds,
      invalidPatientIds: [],
    });

    const result = await assignPatientsToRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      allPatients: true,
    });

    expect(result).toBe(allPatientIds.length);
    expect(getPatientIds_mock).toHaveBeenCalledWith({ cxId: roster.cxId });
    expect(patientRosterModel_bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining(
        allPatientIds.map(patientId =>
          expect.objectContaining({
            patientId,
            rosterId: roster.id,
          })
        )
      ),
      expect.objectContaining({
        ignoreDuplicates: true,
      })
    );
  });

  it("removes duplicate patient IDs", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "patient2", "patient1", "patient3"];
    const uniquePatientIds = ["patient1", "patient2", "patient3"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    verifyPatients_mock.mockResolvedValue({
      validPatientIds: uniquePatientIds,
      invalidPatientIds: [],
    });

    const result = await assignPatientsToRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      patientIds,
    });

    expect(result).toBe(3);
    expect(verifyPatients_mock).toHaveBeenCalledWith({
      patientIds: uniquePatientIds,
      cxId: roster.cxId,
    });
    expect(patientRosterModel_bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ patientId: "patient1" }),
        expect.objectContaining({ patientId: "patient2" }),
        expect.objectContaining({ patientId: "patient3" }),
      ]),
      expect.anything()
    );
  });

  it("throws BadRequestError when roster is closed", async () => {
    const roster = makeRosterModel({ status: "closed" });
    const patientIds = ["patient1"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);

    await expect(
      assignPatientsToRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
        patientIds,
      })
    ).rejects.toThrow(BadRequestError);

    expect(verifyPatients_mock).not.toHaveBeenCalled();
    expect(patientRosterModel_bulkCreate).not.toHaveBeenCalled();
  });

  it("handles partial assignment failures gracefully", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "patient2", "patient3"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    verifyPatients_mock.mockResolvedValue({
      validPatientIds: patientIds,
      invalidPatientIds: [],
    });
    patientRosterModel_bulkCreate.mockResolvedValue([
      makePatientRosterModel({ patientId: "patient1" }),
      makePatientRosterModel({ patientId: "patient2" }),
    ]);

    const result = await assignPatientsToRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      patientIds,
    });

    expect(result).toBe(2);
  });

  it("throws BadRequestError when invalid patient IDs are provided", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "patient2", "patient3", "invalid1"];
    const validPatientIds = ["patient1", "patient2", "patient3"];
    const invalidPatientIds = ["invalid1"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    verifyPatients_mock.mockResolvedValue({
      validPatientIds,
      invalidPatientIds,
    });

    await expect(
      assignPatientsToRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
        patientIds,
      })
    ).rejects.toThrow(BadRequestError);

    expect(verifyPatients_mock).toHaveBeenCalledWith({
      patientIds: [...new Set(patientIds)],
      cxId: roster.cxId,
    });
    expect(patientRosterModel_bulkCreate).not.toHaveBeenCalled();
  });

  it("throws BadRequestError when all patient IDs are invalid", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["invalid1", "invalid2"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    verifyPatients_mock.mockResolvedValue({
      validPatientIds: [],
      invalidPatientIds: patientIds,
    });

    await expect(
      assignPatientsToRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
        patientIds,
      })
    ).rejects.toThrow(BadRequestError);

    expect(verifyPatients_mock).toHaveBeenCalledWith({
      patientIds: [...new Set(patientIds)],
      cxId: roster.cxId,
    });
    expect(patientRosterModel_bulkCreate).not.toHaveBeenCalled();
  });

  it("throws BadRequestError with correct error message and metadata for invalid patients", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "invalid1", "invalid2"];
    const invalidPatientIds = ["invalid1", "invalid2"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    verifyPatients_mock.mockResolvedValue({
      validPatientIds: ["patient1"],
      invalidPatientIds,
    });

    let error: unknown;
    try {
      await assignPatientsToRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
        patientIds,
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(BadRequestError);
    if (error instanceof BadRequestError) {
      expect(error.message).toBe("Invalid patient IDs provided");
      expect(error.additionalInfo).toEqual({
        rosterId: roster.id,
        cxId: roster.cxId,
        invalidPatientCount: invalidPatientIds.length,
      });
    }
  });
});
