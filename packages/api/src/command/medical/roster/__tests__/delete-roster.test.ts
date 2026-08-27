import { BadRequestError } from "@metriport/shared";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { RosterModel } from "../../../../models/medical/roster";
import { deleteRoster } from "../delete-roster";
import * as getRoster from "../get-roster";
import * as getRosterSize from "../patient-roster/get-roster-size";
import { makeRosterModel } from "./make-roster";

jest.mock("../../../../models/medical/roster");
jest.mock("../../../../models/medical/patient-roster");
jest.mock("../get-roster");
jest.mock("../patient-roster/get-roster-size");

describe("deleteRoster", () => {
  let rosterModel_destroy: jest.SpyInstance;
  let getRosterOrFail_mock: jest.SpyInstance;
  let getRosterSize_mock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    getRosterOrFail_mock = jest.spyOn(getRoster, "getRosterOrFail");
    getRosterSize_mock = jest.spyOn(getRosterSize, "getRosterSize");
    rosterModel_destroy = jest.spyOn(RosterModel, "destroy").mockResolvedValue(1);
  });

  it("deletes an empty roster", async () => {
    const roster = makeRosterModel();
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    getRosterSize_mock.mockResolvedValue(0);

    await deleteRoster({
      rosterId: roster.id,
      cxId: roster.cxId,
    });

    expect(rosterModel_destroy).toHaveBeenCalledWith({
      where: { id: roster.id, cxId: roster.cxId },
    });
  });

  it("throws BadRequestError when roster is not empty", async () => {
    const roster = makeRosterModel();
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    getRosterSize_mock.mockResolvedValue(5);

    await expect(
      deleteRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
      })
    ).rejects.toThrow(BadRequestError);

    expect(rosterModel_destroy).not.toHaveBeenCalled();
  });

  it("throws BadRequestError with correct message and context", async () => {
    const roster = makeRosterModel();
    const size = 10;
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    getRosterSize_mock.mockResolvedValue(size);

    await expect(
      deleteRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
      })
    ).rejects.toThrow("Roster is not empty");

    try {
      await deleteRoster({
        rosterId: roster.id,
        cxId: roster.cxId,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      if (error instanceof BadRequestError) {
        expect(error.additionalInfo).toEqual({
          rosterId: roster.id,
          cxId: roster.cxId,
          size,
        });
      }
    }
  });
});
