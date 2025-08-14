import { buildDayjs } from "@metriport/shared/common/date";
import { buildRosterFile } from "../file/file-generator";
import { getArtifact } from "./shared";
import { generalMnemonic } from "../codes";

describe("Roster generation test", () => {
  it("should generate a roster from a list of patients", () => {
    const patientJson = getArtifact("patients.json").toString();
    const patients = JSON.parse(patientJson);
    expect(Array.isArray(patients)).toBe(true);

    const rosterFile = buildRosterFile(patients);
    const expectedRosterContent = getArtifact("roster.txt");
    // Ensure that tests still pass, since the header incorporates the current date.
    const expectedHeader = `H${generalMnemonic}${buildDayjs().format("YYYYMMDD")}`.padEnd(426, " ");
    expect(rosterFile.toString()).toEqual(`${expectedHeader}\n${expectedRosterContent.toString()}`);
  });
});
