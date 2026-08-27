import { BadRequestError } from "@metriport/shared";
import { Op } from "sequelize";
import { mockStartTransaction } from "../../../../../models/__tests__/transaction";
import { PatientRosterModel } from "../../../../../models/medical/patient-roster";
import * as getRoster from "../../get-roster";
import { removePatientsFromRoster } from "../../patient-roster/remove-patients-from-roster";
import { makeRosterModel } from "../make-roster";

jest.mock("../../../../../models/medical/patient-roster");
jest.mock("../../get-roster");

describe("removePatientsFromRoster", () => {
  let patientRosterModel_destroy: jest.SpyInstance;
  let patientRosterModel_findAll: jest.SpyInstance;
  let getRosterOrFail_mock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    getRosterOrFail_mock = jest.spyOn(getRoster, "getRosterOrFail");
    patientRosterModel_findAll = jest.spyOn(PatientRosterModel, "findAll");
    patientRosterModel_destroy = jest.spyOn(PatientRosterModel, "destroy");
  });

  it("removes specific patients from an open roster", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "patient2"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue(
      patientIds.map(patientId => ({ patientId } as PatientRosterModel))
    );
    patientRosterModel_destroy.mockResolvedValue(patientIds.length);

    const result = await removePatientsFromRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      patientIds,
    });

    expect(result).toBe(patientIds.length);
    expect(patientRosterModel_findAll).toHaveBeenCalledWith({
      where: { rosterId: roster.id, patientId: { [Op.in]: patientIds } },
      attributes: ["patientId"],
    });
    expect(patientRosterModel_destroy).toHaveBeenCalledWith({
      where: {
        rosterId: roster.id,
        patientId: { [Op.in]: patientIds },
      },
    });
  });

  it("removes all patients when all is true", async () => {
    const roster = makeRosterModel({ status: "open" });
    const deletedCount = 5;
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_destroy.mockResolvedValue(deletedCount);

    const result = await removePatientsFromRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      allPatients: true,
    });

    expect(result).toBe(deletedCount);
    expect(patientRosterModel_destroy).toHaveBeenCalledWith({
      where: {
        rosterId: roster.id,
      },
    });
  });

  it("throws BadRequestError when roster is closed", async () => {
    const roster = makeRosterModel({ status: "closed" });
    const patientIds = ["patient1"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);

    await expect(
      removePatientsFromRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
        patientIds,
      })
    ).rejects.toThrow(BadRequestError);

    expect(patientRosterModel_findAll).not.toHaveBeenCalled();
    expect(patientRosterModel_destroy).not.toHaveBeenCalled();
  });

  it("warns when not all patients are removed", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "patient2", "patient3"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue(
      patientIds.map(patientId => ({ patientId } as PatientRosterModel))
    );
    patientRosterModel_destroy.mockResolvedValue(2);

    const result = await removePatientsFromRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      patientIds,
    });

    expect(result).toBe(2);
  });

  it("throws BadRequestError when patient IDs do not exist in roster", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "patient2", "missing1"];
    const existingPatientIds = ["patient1", "patient2"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue(
      existingPatientIds.map(patientId => ({ patientId } as PatientRosterModel))
    );

    await expect(
      removePatientsFromRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
        patientIds,
      })
    ).rejects.toThrow(BadRequestError);

    expect(patientRosterModel_findAll).toHaveBeenCalledWith({
      where: { rosterId: roster.id, patientId: { [Op.in]: patientIds } },
      attributes: ["patientId"],
    });
    expect(patientRosterModel_destroy).not.toHaveBeenCalled();
  });

  it("throws BadRequestError with correct error message and metadata for missing patients", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "missing1", "missing2"];
    const existingPatientIds = ["patient1"];
    const missingPatientIds = ["missing1", "missing2"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue(
      existingPatientIds.map(patientId => ({ patientId } as PatientRosterModel))
    );

    let error: unknown;
    try {
      await removePatientsFromRoster({
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
        missingPatientCount: missingPatientIds.length,
      });
    }
  });

  it("removes duplicate patient IDs before checking existence", async () => {
    const roster = makeRosterModel({ status: "open" });
    const patientIds = ["patient1", "patient2", "patient1"];
    const uniquePatientIds = ["patient1", "patient2"];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue(
      uniquePatientIds.map(patientId => ({ patientId } as PatientRosterModel))
    );
    patientRosterModel_destroy.mockResolvedValue(uniquePatientIds.length);

    const result = await removePatientsFromRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      patientIds,
    });

    expect(result).toBe(uniquePatientIds.length);
    expect(patientRosterModel_findAll).toHaveBeenCalledWith({
      where: { rosterId: roster.id, patientId: { [Op.in]: uniquePatientIds } },
      attributes: ["patientId"],
    });
  });
});
