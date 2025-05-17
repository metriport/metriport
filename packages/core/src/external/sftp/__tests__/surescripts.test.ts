import SurescriptsSftpClient from "../surescripts/sftp";
import { TransmissionType } from "../surescripts/sftp";

describe("Surescripts SFTP Client", () => {
  it("should create a client", () => {
    const client = new SurescriptsSftpClient({
      senderId: "TestSenderId",
      senderPassword: "TestSenderPassword",
      host: "localhost",
      port: 22,
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
      host: "localhost",
      port: 22,
      username: "test",
      password: "test",
      privateKey: "test",
    });

    const transmission = client.createTransmission(TransmissionType.Enroll, "TestPopulation");
    expect(transmission).toBeDefined();
  });
});
