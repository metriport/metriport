import { buildRosterFile } from "../file/file-generator";
import { getArtifact } from "./shared";

describe("Roster generation test", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date("2025-02-01T00:00:00.000Z"));
  });

  it("should generate a roster from a list of patients", () => {
    const patientJson = getArtifact("patients.json").toString();
    const patients = JSON.parse(patientJson);
    expect(Array.isArray(patients)).toBe(true);

    const rosterFile = buildRosterFile(patients, "backfill");
    const expectedRosterContent = getArtifact("roster.txt");
    expect(rosterFile.toString()).toEqual(expectedRosterContent.toString());
  });
});
