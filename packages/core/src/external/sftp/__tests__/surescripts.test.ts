import SurescriptsSftpClient from "../surescripts/client";
import { TransmissionType } from "../surescripts/client";

describe("Surescripts SFTP Client", () => {
  it("should create a client", () => {
    const client = new SurescriptsSftpClient({
      senderId: "TestSenderId",
      senderPassword: "TestSenderPassword",
      username: "test",
      password: "test",
      privateKey: "test",
    });

    expect(client).toBeDefined();
  });

  it("should create a transmission", () => {
    const client = new SurescriptsSftpClient({
      senderId: "TestSenderId",
      senderPassword: "TestSenderPassword",
      username: "test",
      password: "test",
      privateKey: "test",
    });

    const transmission = client.createTransmission(TransmissionType.Enroll, {
      npiNumber: "1234567890",
      cxId: "CustomerId",
    });
    expect(transmission).toBeDefined();
  });
});
