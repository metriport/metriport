import { getArtifact } from "./shared";
import { fromSurescriptsFlatFileResponse } from "../message";

describe("Flat file response", () => {
  it("should parse a successful flat file response", () => {
    const response = getArtifact("ffm/success.txt");
    fromSurescriptsFlatFileResponse(response);
  });
});
