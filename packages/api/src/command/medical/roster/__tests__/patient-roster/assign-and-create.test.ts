import { mockStartTransaction } from "../../../../../models/__tests__/transaction";
import * as createRoster from "../../create-roster";
import * as getRoster from "../../get-roster";
import * as assignPatients from "../../patient-roster/assign-patients-to-roster";
import { assignPatientsAndCreateRoster } from "../../patient-roster/assign-patients-and-create-roster";
import { makeRosterModel } from "../make-roster";

jest.mock("../../../../../models/medical/roster");
jest.mock("../../patient-roster/assign-patients-to-roster");
jest.mock("../../create-roster");
jest.mock("../../get-roster");

describe("assignPatientsAndCreateRoster", () => {
  let getLatestRoster_mock: jest.SpyInstance;
  let createRoster_mock: jest.SpyInstance;
  let assignPatientsToRoster_mock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockStartTransaction();
    getLatestRoster_mock = jest.spyOn(getRoster, "getLatestRoster");
    createRoster_mock = jest.spyOn(createRoster, "createRoster");
    assignPatientsToRoster_mock = jest.spyOn(assignPatients, "assignPatientsToRoster");
  });

  it("assigns patients to existing roster", async () => {
    const roster = makeRosterModel();
    const patientIds = ["patient1", "patient2"];
    const assignCount = 2;

    getLatestRoster_mock.mockResolvedValue(roster.dataValues);
    assignPatientsToRoster_mock.mockResolvedValue(assignCount);

    const result = await assignPatientsAndCreateRoster({
      cxId: roster.cxId,
      source: roster.source,
      type: roster.type,
      data: roster.data,
      patientIds,
    });

    expect(result).toEqual({ roster: roster.dataValues, count: assignCount });
    expect(getLatestRoster_mock).toHaveBeenCalledWith({
      cxId: roster.cxId,
      source: roster.source,
      type: roster.type,
      status: "open",
    });
    expect(createRoster_mock).not.toHaveBeenCalled();
    expect(assignPatientsToRoster_mock).toHaveBeenCalledWith({
      rosterId: roster.id,
      cxId: roster.cxId,
      patientIds,
      allPatients: undefined,
    });
  });

  it("creates roster and assigns patients when roster does not exist", async () => {
    const newRoster = makeRosterModel();
    const patientIds = ["patient1", "patient2"];
    const assignCount = 2;

    getLatestRoster_mock.mockResolvedValue(undefined);
    createRoster_mock.mockResolvedValue(newRoster.dataValues);
    assignPatientsToRoster_mock.mockResolvedValue(assignCount);

    const result = await assignPatientsAndCreateRoster({
      cxId: newRoster.cxId,
      source: newRoster.source,
      type: newRoster.type,
      data: newRoster.data,
      patientIds,
    });

    expect(result).toEqual({ roster: newRoster.dataValues, count: assignCount });
    expect(getLatestRoster_mock).toHaveBeenCalledWith({
      cxId: newRoster.cxId,
      source: newRoster.source,
      type: newRoster.type,
      status: "open",
    });
    expect(createRoster_mock).toHaveBeenCalledWith({
      cxId: newRoster.cxId,
      source: newRoster.source,
      type: newRoster.type,
      data: newRoster.data,
    });
    expect(assignPatientsToRoster_mock).toHaveBeenCalledWith({
      rosterId: newRoster.id,
      cxId: newRoster.cxId,
      patientIds,
      allPatients: undefined,
    });
  });

  it("assigns all patients when all is true", async () => {
    const roster = makeRosterModel();
    const assignCount = 10;

    getLatestRoster_mock.mockResolvedValue(roster.dataValues);
    assignPatientsToRoster_mock.mockResolvedValue(assignCount);

    const result = await assignPatientsAndCreateRoster({
      cxId: roster.cxId,
      source: roster.source,
      type: roster.type,
      data: roster.data,
      allPatients: true,
    });

    expect(result).toEqual({ roster: roster.dataValues, count: assignCount });
    expect(assignPatientsToRoster_mock).toHaveBeenCalledWith({
      rosterId: roster.id,
      cxId: roster.cxId,
      patientIds: undefined,
      allPatients: true,
    });
  });
});
