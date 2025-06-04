import { SurescriptsSftpClient } from "../client";
import dayjs from "dayjs";

class SurescriptsSftpClientTest extends SurescriptsSftpClient {
  constructor() {
    super({
      host: "test.com",
      port: 22,
      username: "test",
      senderId: "test",
      senderPassword: "test",
      receiverId: "test",
      publicKey: "test",
      privateKey: "test",
      replicaBucket: "test",
      replicaBucketRegion: "us-east-2",
    });
  }

  testFlatFileResponseSuffix(timestamp: number) {
    return this.getFlatFileResponseSuffix(timestamp);
  }

  testParseVerificationFileName(remoteFileName: string) {
    return this.parseVerificationFileName(remoteFileName);
  }
}

describe("Surescripts file names", () => {
  it("should parse verification file name", () => {
    const client = new SurescriptsSftpClientTest();
    const acceptedBySurescripts = new Date(2025, 6, 1, 12, 0, 0);
    const result = client.testParseVerificationFileName(
      `Metriport_PMA_20250601--TESTID_12.${acceptedBySurescripts.getTime()}.rsp`
    );
    expect(result).toEqual({
      requestFileNameWithoutExtension: "Metriport_PMA_20250601--TESTID_12",
      acceptedBySurescripts,
      compression: false,
    });
  });

  it("should parse a verification file from a compressed input file", () => {
    const client = new SurescriptsSftpClientTest();
    const acceptedBySurescripts = new Date(2025, 6, 1, 12, 0, 0);
    const result = client.testParseVerificationFileName(
      `Metriport_PMA_20250601--TESTID_12.${acceptedBySurescripts.getTime()}.gz.rsp`
    );
    expect(result).toEqual({
      requestFileNameWithoutExtension: "Metriport_PMA_20250601--TESTID_12",
      acceptedBySurescripts,
      compression: true,
    });
  });

  it("should not parse invalid verification file based on extension", () => {
    const client = new SurescriptsSftpClientTest();
    const result = client.testParseVerificationFileName(
      `Metriport_PMA_20250601--TESTID_12.1234567890.notaresponse`
    );
    expect(result).toBeUndefined();
  });

  it("should not parse verification file name with invalid timestamp", () => {
    const client = new SurescriptsSftpClientTest();
    const result = client.testParseVerificationFileName(
      `Metriport_PMA_20250601--TESTID_12.invalid.rsp`
    );
    expect(result).toBeUndefined();
  });

  it("should parse patient load file name", () => {
    const client = new SurescriptsSftpClientTest();
    const timestamp = Date.now();
    const result = client.testFlatFileResponseSuffix(timestamp);
    expect(result).toEqual(`_${dayjs(timestamp).format("YYYYMMDDHHmmss")}.gz`);
  });
});
