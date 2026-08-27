import { Transaction } from "sequelize";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { RosterModel } from "../../../../models/medical/roster";
import { createRoster } from "../create-roster";
import { makeRosterCreateCmd, makeRosterModel } from "./make-roster";

jest.mock("../../../../models/medical/roster");

describe("createRoster", () => {
  let rosterModel_create: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    rosterModel_create = jest.spyOn(RosterModel, "create").mockImplementation(async data => {
      if (!data) throw new Error("Data is required");
      const roster = makeRosterModel({
        id: data.id,
        cxId: data.cxId,
        source: data.source,
        type: data.type,
        status: data.status,
        data: data.data,
      });
      return roster;
    });
  });

  it("creates a roster with all required fields", async () => {
    const cmd = makeRosterCreateCmd();
    const result = await createRoster(cmd);

    expect(rosterModel_create).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId: cmd.cxId,
        source: cmd.source,
        type: cmd.type,
        status: cmd.status,
        data: cmd.data,
      }),
      expect.objectContaining({})
    );
    expect(result).toEqual(
      expect.objectContaining({
        cxId: cmd.cxId,
        source: cmd.source,
        type: cmd.type,
        status: cmd.status,
      })
    );
  });

  it("creates a roster with optional fields", async () => {
    const cmd = makeRosterCreateCmd({
      data: { custom: "data" },
    });
    const result = await createRoster(cmd);

    expect(rosterModel_create).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId: cmd.cxId,
        source: cmd.source,
        type: cmd.type,
        status: cmd.status,
        data: cmd.data,
      }),
      expect.objectContaining({})
    );
    expect(result).toEqual(
      expect.objectContaining({
        cxId: cmd.cxId,
        source: cmd.source,
        type: cmd.type,
        status: cmd.status,
      })
    );
  });

  it("creates a roster with transaction", async () => {
    const cmd = makeRosterCreateCmd();
    const mockTransaction = {} as unknown as Transaction;
    const result = await createRoster({ ...cmd, transaction: mockTransaction });

    expect(rosterModel_create).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId: cmd.cxId,
        source: cmd.source,
        type: cmd.type,
        status: cmd.status,
      }),
      expect.objectContaining({
        transaction: mockTransaction,
      })
    );
    expect(result).toBeDefined();
  });
});
