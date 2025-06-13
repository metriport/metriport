import {
  parseVerificationFileName,
  parseResponseFileName,
  parseHistoryFileName,
  makeRequestFileName,
  makeResponseFileNamePrefix,
} from "../file-names";

describe("File names for patient requests", () => {
  const testTransmissionId = "-OSaV613EU";
  const expectedRequestFileName = "Metriport_PMA_20250612--OSaV613EU";
  const testPatientId = "0196ffa8-a1bf-75cc-ab88-dc2472161e31";

  it("should make request file name", () => {
    const requestFileName = makeRequestFileName(testTransmissionId);
    expect(requestFileName).toEqual(expectedRequestFileName);
  });

  it("should parse history file name", () => {
    const fileName = "250612_113628_Metriport_PMA_20250612--OSaV613EU.T00000000000001";
    const parsedFileName = parseHistoryFileName(fileName);
    expect(parsedFileName).toEqual({
      requestFileName: "Metriport_PMA_20250612--OSaV613EU",
      senderId: "T00000000000001",
      createdAt: new Date("2025-06-12T11:36:28.000Z"),
    });
  });

  it("should make response file name prefix", () => {
    const responseFileNamePrefix = makeResponseFileNamePrefix(testTransmissionId, testPatientId);
    expect(responseFileNamePrefix).toEqual("-OSaV613EU_0196ffa8-a1bf-75cc-ab88-dc2472161e31_");
  });

  it("should parse response file name", () => {
    const fileName = "-OSaV613EU_0196ffa8-a1bf-75cc-ab88-dc2472161e31_3241590_20250612233806.gz";
    const result = parseResponseFileName(fileName);
    expect(result).toEqual({
      transmissionId: "-OSaV613EU",
      populationId: "0196ffa8-a1bf-75cc-ab88-dc2472161e31",
      externalFileId: "3241590",
      responseDate: new Date("2025-06-12T23:38:06.000Z"),
    });
  });

  it("should parse verification file name", () => {
    const fileName = "1234567890_1234567890_1234567890_1234567890.gz";
    const result = parseVerificationFileName(fileName);
    expect(result).toEqual({
      requestFileName: "1234567890",
      acceptedBySurescripts: new Date("2025-06-12T23:38:06.000Z"),
    });
  });
});
