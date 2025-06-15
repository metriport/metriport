import { getArtifact } from "./shared";
import { parseResponseFile } from "../file-parser";

describe("Flat file response", () => {
  it("should parse a successful flat file response", () => {
    const successfulResponse = getArtifact("success/ffm.txt");
    const { header, details, footer } = parseResponseFile(successfulResponse);
    expect(header.data.version).toEqual("3.0");
    expect(footer.data.processedRecordCount).toEqual(details.length);
  });
});
