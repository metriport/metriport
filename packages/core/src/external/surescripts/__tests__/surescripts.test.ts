import { SurescriptsSftpClient } from "../client";
import { TransmissionType } from "../client";

describe("Surescripts SFTP Client", () => {
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
    });

    expect(client).toBeDefined();
  });

  it("should create a transmission", () => {
    const client = new SurescriptsSftpClient({
      host: "TestHost",
      senderId: "TestSenderId",
      senderPassword: "TestSenderPassword",
      receiverId: "TestReceiverId",
      username: "test",
      publicKey: "test",
      privateKey: "test",
      replicaBucket: "test",
    });

    const transmission = client.createTransmission(TransmissionType.Enroll, {
      npiNumber: "1234567890",
      cxId: "CustomerId",
    });
    expect(transmission).toBeDefined();
  });
});
