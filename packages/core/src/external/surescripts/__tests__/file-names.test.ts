import {
  parseVerificationFileName,
  parseResponseFileName,
  parseHistoryFileName,
  buildRequestFileName,
  buildResponseFileNamePrefix,
} from "../file/file-names";

describe("File names for patient requests", () => {
  const testTransmissionId = "-OSaV613EU";
  const testSenderId = "T00000000000001";
  const testPatientId = "0196ffa8-a1bf-75cc-ab88-dc2472161e31";

  const expectedRequestFileName = "Metriport_PMA_20250612--OSaV613EU";
  const expectedResponseFilePrefix = `${testTransmissionId}_${testPatientId}_`;
  const expectedVerificationFileName = "Metriport_PMA_20250612--OSaV613EU.1749771418926.rsp";
  const expectedResponseFile =
    "-OSaV613EU_0196ffa8-a1bf-75cc-ab88-dc2472161e31_3241590_20250612233806.gz";

  it("should make request file name", () => {
    const requestFileName = buildRequestFileName(testTransmissionId);
    expect(requestFileName).toEqual(expectedRequestFileName);
  });

  it("should parse history file name", () => {
    const fileName = "250612_113628_Metriport_PMA_20250612--OSaV613EU.T00000000000001";
    const parsedFileName = parseHistoryFileName(fileName);
    expect(parsedFileName).toEqual({
      requestFileName: expectedRequestFileName,
      senderId: testSenderId,
    });
  });

  it("should make response file name prefix", () => {
    const responseFileNamePrefix = buildResponseFileNamePrefix(testTransmissionId, testPatientId);
    expect(responseFileNamePrefix).toEqual(expectedResponseFilePrefix);
  });

  it("should parse response file name", () => {
    const result = parseResponseFileName(expectedResponseFile);
    expect(result).toEqual({
      transmissionId: testTransmissionId,
      populationId: testPatientId,
      externalFileId: "3241590",
      responseDate: new Date("2025-06-12T23:38:06.000Z"), // in local time
    });
  });

  it("should parse verification file name", () => {
    const result = parseVerificationFileName(expectedVerificationFileName);
    expect(result).toEqual({
      requestFileName: expectedRequestFileName,
      createdAt: new Date(1749771418926),
    });
  });
});
