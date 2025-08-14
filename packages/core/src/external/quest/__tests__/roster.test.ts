import { buildRosterFile } from "../file/file-generator";
import { getArtifact } from "./shared";

describe("Roster generation test", () => {
  it("should generate a roster from a list of patients", () => {
    const patientJson = getArtifact("patients.json").toString();
    const patients = JSON.parse(patientJson);
    expect(Array.isArray(patients)).toBe(true);

    const rosterFile = buildRosterFile(patients);
    const expectedRosterFile = getArtifact("roster.txt");
    expect(Buffer.compare(rosterFile, expectedRosterFile)).toBe(0);
  });
});
