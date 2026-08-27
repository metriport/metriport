import { NotFoundError } from "@metriport/shared";
import { Transaction } from "sequelize";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { PatientRosterModel } from "../../../../models/medical/patient-roster";
import { RosterModel } from "../../../../models/medical/roster";
import {
  getLatestRoster,
  getRoster,
  getRosterModel,
  getRosterModelOrFail,
  getRosterOrFail,
  getRosterWithSize,
  listRosters,
} from "../get-roster";
import { makeRosterModel } from "./make-roster";

jest.mock("../../../../models/medical/roster");
jest.mock("../../../../models/medical/patient-roster");

describe("getRoster", () => {
  let rosterModel_findOne: jest.SpyInstance;
  let patientRosterModel_count: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    rosterModel_findOne = jest.spyOn(RosterModel, "findOne");
    patientRosterModel_count = jest.spyOn(PatientRosterModel, "count");
  });

  describe("getRosterModel", () => {
    it("returns roster model when found", async () => {
      const roster = makeRosterModel();
      rosterModel_findOne.mockResolvedValue(roster);

      const result = await getRosterModel({
        rosterId: roster.id,
        cxId: roster.cxId,
      });

      expect(result).toEqual(roster);
      expect(rosterModel_findOne).toHaveBeenCalledWith({
        where: { id: roster.id, cxId: roster.cxId },
        transaction: undefined,
        lock: undefined,
      });
    });

    it("returns undefined when not found", async () => {
      rosterModel_findOne.mockResolvedValue(null);

      const result = await getRosterModel({
        rosterId: "non-existent",
        cxId: "cx-id",
      });

      expect(result).toBeUndefined();
    });

    it("passes transaction and lock options", async () => {
      const roster = makeRosterModel();
      const mockTransaction = {} as unknown as Transaction;
      rosterModel_findOne.mockResolvedValue(roster);

      await getRosterModel({
        rosterId: roster.id,
        cxId: roster.cxId,
        transaction: mockTransaction,
        lock: true,
      });

      expect(rosterModel_findOne).toHaveBeenCalledWith({
        where: { id: roster.id, cxId: roster.cxId },
        transaction: mockTransaction,
        lock: true,
      });
    });
  });

  describe("getRosterModelOrFail", () => {
    it("returns roster model when found", async () => {
      const roster = makeRosterModel();
      rosterModel_findOne.mockResolvedValue(roster);

      const result = await getRosterModelOrFail({
        rosterId: roster.id,
        cxId: roster.cxId,
      });

      expect(result).toEqual(roster);
    });

    it("throws NotFoundError when not found", async () => {
      rosterModel_findOne.mockResolvedValue(null);

      await expect(
        getRosterModelOrFail({
          rosterId: "non-existent",
          cxId: "cx-id",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getRoster", () => {
    it("returns roster data when found", async () => {
      const roster = makeRosterModel();
      rosterModel_findOne.mockResolvedValue(roster);

      const result = await getRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
      });

      expect(result).toEqual(roster.dataValues);
    });

    it("returns undefined when not found", async () => {
      rosterModel_findOne.mockResolvedValue(null);

      const result = await getRoster({
        rosterId: "non-existent",
        cxId: "cx-id",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("getRosterOrFail", () => {
    it("returns roster data when found", async () => {
      const roster = makeRosterModel();
      rosterModel_findOne.mockResolvedValue(roster);

      const result = await getRosterOrFail({
        rosterId: roster.id,
        cxId: roster.cxId,
      });

      expect(result).toEqual(roster.dataValues);
    });

    it("throws NotFoundError when not found", async () => {
      rosterModel_findOne.mockResolvedValue(null);

      await expect(
        getRosterOrFail({
          rosterId: "non-existent",
          cxId: "cx-id",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getRosterWithSize", () => {
    it("returns roster with size", async () => {
      const roster = makeRosterModel();
      const size = 5;
      rosterModel_findOne.mockResolvedValue(roster);
      patientRosterModel_count.mockResolvedValue(size);

      const result = await getRosterWithSize({
        rosterId: roster.id,
        cxId: roster.cxId,
      });

      expect(result).toEqual({
        ...roster.dataValues,
        size,
      });
      expect(patientRosterModel_count).toHaveBeenCalledWith({
        where: { rosterId: roster.id },
      });
    });
  });

  describe("listRosters", () => {
    it("returns all rosters for cxId", async () => {
      const rosters = [makeRosterModel(), makeRosterModel()];
      jest.spyOn(RosterModel, "findAll").mockResolvedValue(rosters);

      const result = await listRosters({
        cxId: "cx-id",
      });

      expect(result).toEqual(rosters.map(r => r.dataValues));
      expect(RosterModel.findAll).toHaveBeenCalledWith({
        where: {
          cxId: "cx-id",
        },
      });
    });

    it("filters by source, type, and status", async () => {
      const rosters = [makeRosterModel()];
      jest.spyOn(RosterModel, "findAll").mockResolvedValue(rosters);

      await listRosters({
        cxId: "cx-id",
        source: "source1",
        type: "type1",
        status: "open",
      });

      expect(RosterModel.findAll).toHaveBeenCalledWith({
        where: {
          cxId: "cx-id",
          source: "source1",
          type: "type1",
          status: "open",
        },
      });
    });

    it("sorts by createdAt when sortBy is provided", async () => {
      const rosters = [makeRosterModel()];
      jest.spyOn(RosterModel, "findAll").mockResolvedValue(rosters);

      await listRosters({
        cxId: "cx-id",
        sortBy: { column: "createdAt", order: "DESC" },
      });

      expect(RosterModel.findAll).toHaveBeenCalledWith({
        where: {
          cxId: "cx-id",
        },
        order: [["createdAt", "DESC"]],
      });
    });

    it("limits results when limit is provided", async () => {
      const rosters = [makeRosterModel(), makeRosterModel(), makeRosterModel()];
      const limit = 2;
      jest.spyOn(RosterModel, "findAll").mockResolvedValue(rosters.slice(0, limit));

      const result = await listRosters({
        cxId: "cx-id",
        limit,
      });

      expect(result).toEqual(rosters.slice(0, limit).map(r => r.dataValues));
      expect(RosterModel.findAll).toHaveBeenCalledWith({
        where: {
          cxId: "cx-id",
        },
        limit,
      });
    });
  });

  describe("getLatestRoster", () => {
    it("returns the latest roster", async () => {
      const rosters = [makeRosterModel(), makeRosterModel()];
      jest.spyOn(RosterModel, "findAll").mockResolvedValue(rosters);

      const result = await getLatestRoster({
        cxId: "cx-id",
        source: "source1",
        type: "type1",
      });

      expect(result).toEqual(rosters[0].dataValues);
      expect(RosterModel.findAll).toHaveBeenCalledWith({
        where: {
          cxId: "cx-id",
          source: "source1",
          type: "type1",
        },
        limit: 1,
        order: [["createdAt", "DESC"]],
      });
    });

    it("returns undefined when no rosters found", async () => {
      jest.spyOn(RosterModel, "findAll").mockResolvedValue([]);

      const result = await getLatestRoster({
        cxId: "cx-id",
        source: "source1",
        type: "type1",
      });

      expect(result).toBeUndefined();
    });

    it("filters by optional status", async () => {
      const rosters = [makeRosterModel()];
      jest.spyOn(RosterModel, "findAll").mockResolvedValue(rosters);

      await getLatestRoster({
        cxId: "cx-id",
        source: "source1",
        type: "type1",
        status: "open",
      });

      expect(RosterModel.findAll).toHaveBeenCalledWith({
        where: {
          cxId: "cx-id",
          source: "source1",
          type: "type1",
          status: "open",
        },
        limit: 1,
        order: [["createdAt", "DESC"]],
      });
    });
  });
});
