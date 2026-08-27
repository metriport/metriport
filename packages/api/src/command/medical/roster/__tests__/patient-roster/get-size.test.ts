import { PatientRosterModel } from "../../../../../models/medical/patient-roster";
import { mockStartTransaction } from "../../../../../models/__tests__/transaction";
import { getRosterSize } from "../../patient-roster/get-roster-size";
import * as getRoster from "../../get-roster";
import { makeRosterModel } from "../make-roster";

jest.mock("../../../../../models/medical/patient-roster");
jest.mock("../../get-roster");

describe("getSizeOfRoster", () => {
  let patientRosterModel_count: jest.SpyInstance;
  let getRosterOrFail_mock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    getRosterOrFail_mock = jest.spyOn(getRoster, "getRosterOrFail");
    patientRosterModel_count = jest.spyOn(PatientRosterModel, "count");
  });

  it("returns the size of a roster", async () => {
    const roster = makeRosterModel();
    const size = 5;
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_count.mockResolvedValue(size);

    const result = await getRosterSize({
      rosterId: roster.id,
      cxId: roster.cxId,
    });

    expect(result).toBe(size);
    expect(patientRosterModel_count).toHaveBeenCalledWith({
      where: { rosterId: roster.id },
    });
  });

  it("returns zero for empty roster", async () => {
    const roster = makeRosterModel();
    const size = 0;
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_count.mockResolvedValue(size);

    const result = await getRosterSize({
      rosterId: roster.id,
      cxId: roster.cxId,
    });

    expect(result).toBe(0);
  });

  it("verifies roster exists before counting", async () => {
    const roster = makeRosterModel();
    const size = 10;
    getRosterOrFail_mock.mockResolvedValue(roster.dataValues);
    patientRosterModel_count.mockResolvedValue(size);

    await getRosterSize({
      rosterId: roster.id,
      cxId: roster.cxId,
    });

    expect(getRosterOrFail_mock).toHaveBeenCalledWith({
      rosterId: roster.id,
      cxId: roster.cxId,
    });
  });
});
