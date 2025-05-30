import { getArtifact } from "./shared";
import { fromSurescriptsVerificationFile } from "../message";

describe("Verification response", () => {
  it("should parse a successful verification response", () => {
    const verificationSuccessFile = getArtifact("vrf/success.txt");
    const response = fromSurescriptsVerificationFile(verificationSuccessFile);
    expect(response.header.loadStatus).toBe("01");
    expect(response.header.loadStatusDescription).toBe("File Loaded Correctly.");
    expect(response.header.transactionId).toBe("8b0e7aa6-750a-4589-80ea-6fe1c4a4410e");
    expect(response.header.transmissionId).toEqual("-OPs04BOxs");
    expect(response.details).toHaveLength(0);
    expect(response.footer.recordType).toBe("STR");
    expect(response.footer.processedRecords).toBe(9);
    expect(response.footer.errorRecords).toBe(0);
    expect(response.footer.loadedRecords).toBe(9);
    expect(response.footer.totalErrors).toBe(0);
  });

  it("should parse a verification response for multiple errors", () => {
    const verificationErrorFile = getArtifact("vrf/missing-multiple.txt");
    const response = fromSurescriptsVerificationFile(verificationErrorFile);
    expect(response.header.loadStatus).toBe("02");
    expect(response.header.loadStatusDescription).toBe("File loaded with errors.");
    expect(response.details).toHaveLength(5);
    expect(response.footer.recordType).toBe("STR");
    expect(response.footer.processedRecords).toBe(10);
    expect(response.footer.errorRecords).toBe(5);
    expect(response.footer.loadedRecords).toBe(5);
    expect(response.footer.totalErrors).toBe(5);
  });
});
