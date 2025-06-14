import { SurescriptsSftpClient } from "../client";

describe("Surescripts SFTP Client", () => {
  it("should fail to create a client without environment variables", () => {
    expect(() => new SurescriptsSftpClient({})).toThrowError();
  });

  it("should create a client", () => {
    const client = new SurescriptsSftpClient({
      host: "TestHost",
      senderId: "TestSenderId",
      receiverId: "TestReceiverId",
      senderPassword: "TestSenderPassword",
      username: "test",
      publicKey: "test",
      privateKey: "test",
      replicaBucket: "test",
      replicaBucketRegion: "us-east-2",
    });

    expect(client).toBeDefined();
  });
});
