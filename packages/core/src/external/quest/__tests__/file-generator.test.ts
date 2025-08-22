import { buildRosterFile } from "../file/file-generator";
import { getArtifact } from "./shared";

describe("File generator test", () => {
  const externalId = "50WNPYD8VT363CR";

  it("should generate a roster file", () => {
    const rosterFile = buildRosterFile([
      {
        id: "1",
        firstName: "John",
        lastName: "Doe",
        address: [
          {
            addressLine1: "123 Main St",
            addressLine2: "Apt 1",
            city: "Anytown",
            state: "CA",
            zip: "12345",
          },
        ],
        facilityIds: ["1"],
        dob: "1990-01-01",
        genderAtBirth: "M",
        externalId,
        dateCreated: new Date().toISOString(),
      },
    ]);

    const expectedRosterFile = getArtifact("generated-roster.txt");
    expect(rosterFile.toString("ascii")).toEqual(expectedRosterFile.toString("ascii"));
  });
});
