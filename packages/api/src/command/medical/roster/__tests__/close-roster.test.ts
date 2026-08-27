import { Transaction } from "sequelize";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import * as getRoster from "../get-roster";
import { updateRoster } from "../update-roster";
import { makeRosterModel } from "./make-roster";

jest.mock("../../../../models/medical/roster");
jest.mock("../get-roster");

describe("closeRoster", () => {
  let rosterModel_update: jest.SpyInstance;
  let getRosterModelOrFail_mock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    getRosterModelOrFail_mock = jest.spyOn(getRoster, "getRosterModelOrFail");
  });

  it("closes an open roster", async () => {
    const roster = makeRosterModel({ status: "open" });
    const updatedRoster = makeRosterModel({
      ...roster.dataValues,
      status: "closed",
    });
    getRosterModelOrFail_mock.mockResolvedValue(roster);
    rosterModel_update = jest.spyOn(roster, "update").mockResolvedValue(updatedRoster);

    const result = await updateRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      status: "closed",
    });

    expect(result).toEqual(updatedRoster.dataValues);
    expect(rosterModel_update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "closed",
      }),
      expect.objectContaining({})
    );
  });

  it("uses forceStatusUpdate to bypass validation", async () => {
    const roster = makeRosterModel({ status: "closed" });
    const updatedRoster = makeRosterModel({
      ...roster.dataValues,
      status: "closed",
    });
    getRosterModelOrFail_mock.mockResolvedValue(roster);
    rosterModel_update = jest.spyOn(roster, "update").mockResolvedValue(updatedRoster);

    await updateRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      status: "closed",
      forceStatusUpdate: true,
    });

    expect(rosterModel_update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "closed",
      }),
      expect.objectContaining({})
    );
  });

  it("passes transaction when provided", async () => {
    const roster = makeRosterModel({ status: "open" });
    const updatedRoster = makeRosterModel({
      ...roster.dataValues,
      status: "closed",
    });
    const mockTransaction = {} as unknown as Transaction;
    getRosterModelOrFail_mock.mockResolvedValue(roster);
    rosterModel_update = jest.spyOn(roster, "update").mockResolvedValue(updatedRoster);

    await updateRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
      status: "closed",
      transaction: mockTransaction,
    });

    expect(getRosterModelOrFail_mock).toHaveBeenCalledWith({
      rosterId: roster.id,
      cxId: roster.cxId,
      transaction: mockTransaction,
      lock: true,
    });
    expect(rosterModel_update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        transaction: mockTransaction,
      })
    );
  });
});
