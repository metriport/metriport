import SurescriptsSftpClient from "../surescripts/sftp";
import { TransmissionType } from "../surescripts/sftp";

describe("Surescripts SFTP Client", () => {
  it("should create a client", () => {
    const client = new SurescriptsSftpClient({
      senderId: "TestSenderId",
      senderPassword: "TestSenderPassword",
    });

    expect(client).toBeDefined();
  });

  it("should create a transmission", () => {
    const client = new SurescriptsSftpClient({
      senderId: "TestSenderId",
      senderPassword: "TestSenderPassword",
    });

    const transmission = client.createTransmission(TransmissionType.Enroll, "TestPopulation");
    expect(transmission).toBeDefined();
  });
});
