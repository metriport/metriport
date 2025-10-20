import { SftpClient } from "../client";

describe("SFTP Client", () => {
  it("should create a client", () => {
    const client = new SftpClient({
      host: "TestHost",
      port: 22,
      username: "test",
      password: "test",
      privateKey: "test",
    });

    expect(client).toBeDefined();
  });
});
