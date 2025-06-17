import { getArtifact } from "./shared";
import { fromSurescriptsFlatFileResponse } from "../file-generator";

describe("Flat file response", () => {
  it("should parse a successful flat file response", () => {
    const successfulResponse = getArtifact("success/ffm.txt");
    const { header, details, footer } = fromSurescriptsFlatFileResponse(successfulResponse);
    expect(header.version).toEqual("3.0");
    expect(footer.processedRecordCount).toEqual(details.length);
  });
});
