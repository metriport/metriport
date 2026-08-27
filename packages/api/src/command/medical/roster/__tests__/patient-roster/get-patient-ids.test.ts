import { PatientRosterModel } from "../../../../../models/medical/patient-roster";
import { mockStartTransaction } from "../../../../../models/__tests__/transaction";
import { getPatientIdsOnRoster } from "../../patient-roster/get-roster-patient-ids";
import * as getRoster from "../../get-roster";
import { makeRosterModel } from "../make-roster";
import { makePatientRosterModel } from "./make-patient-roster";

jest.mock("../../../../../models/medical/patient-roster");
jest.mock("../../get-roster");

describe("getPatientIdsFromRoster", () => {
  let patientRosterModel_findAll: jest.SpyInstance;
  let getRosterOrFail_mock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    getRosterOrFail_mock = jest.spyOn(getRoster, "getRosterOrFail");
    patientRosterModel_findAll = jest.spyOn(PatientRosterModel, "findAll");
  });

  it("returns patient IDs from roster", async () => {
    const roster = makeRosterModel();
    const patientRosters = [
      makePatientRosterModel({ patientId: "patient1" }),
      makePatientRosterModel({ patientId: "patient2" }),
      makePatientRosterModel({ patientId: "patient3" }),
    ];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue(patientRosters);

    const result = await getPatientIdsOnRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
    });

    expect(result).toEqual(["patient1", "patient2", "patient3"]);
    expect(patientRosterModel_findAll).toHaveBeenCalledWith({
      where: { rosterId: roster.id },
      attributes: ["patientId"],
    });
  });

  it("returns empty array when roster has no patients", async () => {
    const roster = makeRosterModel();
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue([]);

    const result = await getPatientIdsOnRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
    });

    expect(result).toEqual([]);
  });

  it("applies pagination filters when provided", async () => {
    const roster = makeRosterModel();
    const patientRosters = [makePatientRosterModel({ patientId: "patient1" })];
    const pagination = {
      count: 10,
    };
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue(patientRosters);

    await getPatientIdsOnRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      pagination,
    });

    expect(patientRosterModel_findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rosterId: roster.id }),
        attributes: ["patientId"],
        order: [["patientId", "DESC"]],
        limit: 10,
      })
    );
  });

  it("verifies roster exists before fetching patient IDs", async () => {
    const roster = makeRosterModel();
    const patientRosters = [makePatientRosterModel({ patientId: "patient1" })];
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_findAll.mockResolvedValue(patientRosters);

    await getPatientIdsOnRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
    });

    expect(getRosterOrFail_mock).toHaveBeenCalledWith({
      rosterId: roster.id,
      cxId: roster.cxId,
    });
  });
});
