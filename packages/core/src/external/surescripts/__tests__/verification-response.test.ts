import { getArtifact } from "./shared";
import { parseVerificationFile } from "../file-parser";

describe("Verification response", () => {
  it("should parse a successful verification response", () => {
    const verificationSuccessFile = getArtifact("success/vrf.txt");
    const response = parseVerificationFile(verificationSuccessFile);
    expect(response.header.data.loadStatus).toBe("01");
    expect(response.header.data.loadStatusDescription).toBe("File Loaded Correctly.");
    expect(response.header.data.transactionId).toBe("8b0e7aa6-750a-4589-80ea-6fe1c4a4410e");
    expect(response.header.data.transmissionId).toEqual("-OPs04BOxs");
    expect(response.details).toHaveLength(0);
    expect(response.footer.data.recordType).toBe("STR");
    expect(response.footer.data.processedRecords).toBe(9);
    expect(response.footer.data.errorRecords).toBe(0);
    expect(response.footer.data.loadedRecords).toBe(9);
    expect(response.footer.data.totalErrors).toBe(0);
  });

  it("should parse a verification response for multiple errors", () => {
    const verificationErrorFile = getArtifact("missing-multiple/vrf.txt");
    const response = parseVerificationFile(verificationErrorFile);
    expect(response.header.data.loadStatus).toBe("02");
    expect(response.header.data.loadStatusDescription).toBe("File loaded with errors.");
    expect(response.details).toHaveLength(5);
    expect(response.footer.data.recordType).toBe("STR");
    expect(response.footer.data.processedRecords).toBe(10);
    expect(response.footer.data.errorRecords).toBe(5);
    expect(response.footer.data.loadedRecords).toBe(5);
    expect(response.footer.data.totalErrors).toBe(5);
  });
});
