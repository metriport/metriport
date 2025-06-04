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
    const processedBySurescripts = new Date(2025, 6, 1, 12, 10, 0);
    const result = client.testParseVerificationFileName(
      `Metriport_PMA_20250601--TESTID_12.${acceptedBySurescripts.getTime()}.${processedBySurescripts.getTime()}.rsp`
    );
    expect(result).toEqual({
      requestFileNameWithoutExtension: "Metriport_PMA_20250601--TESTID_12",
      acceptedBySurescripts,
      processedBySurescripts,
      compression: false,
    });
  });

  it("should parse patient load file name", () => {
    const client = new SurescriptsSftpClientTest();
    const timestamp = Date.now();
    const result = client.testFlatFileResponseSuffix(timestamp);
    expect(result).toEqual(`_${dayjs(timestamp).format("YYYYMMDDHHmmss")}.gz`);
  });
});
