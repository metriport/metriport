import { parseVerificationFileName } from "../file-names";

describe("Surescripts file names", () => {
  it("should parse verification file name", () => {
    const acceptedBySurescripts = new Date(2025, 6, 1, 12, 0, 0);
    const result = parseVerificationFileName(
      `Metriport_PMA_20250601--TESTID_12.${acceptedBySurescripts.getTime()}.rsp`
    );
    expect(result).toEqual({
      requestFileName: "Metriport_PMA_20250601--TESTID_12",
      acceptedBySurescripts,
    });
  });

  it("should parse a verification file from a compressed input file", () => {
    const acceptedBySurescripts = new Date(2025, 6, 1, 12, 0, 0);
    const result = parseVerificationFileName(
      `Metriport_PMA_20250601--TESTID_12.${acceptedBySurescripts.getTime()}.gz.rsp`
    );
    expect(result).toEqual({
      requestFileName: "Metriport_PMA_20250601--TESTID_12",
      acceptedBySurescripts,
    });
  });

  it("should not parse invalid verification file based on extension", () => {
    const result = parseVerificationFileName(
      `Metriport_PMA_20250601--TESTID_12.1234567890.notaresponse`
    );
    expect(result).toBeUndefined();
  });

  it("should not parse verification file name with invalid timestamp", () => {
    const result = parseVerificationFileName(`Metriport_PMA_20250601--TESTID_12.invalid.rsp`);
    expect(result).toBeUndefined();
  });
});
