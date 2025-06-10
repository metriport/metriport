import { Command } from "commander";
import { QuestSftpClient } from "@metriport/core/external/quest/client";

const receiveResponse = new Command();
receiveResponse.name("receive");
receiveResponse.argument("<file>", "The name of the remote file to receive");

receiveResponse.action(async (fileName: string) => {
  const client = new QuestSftpClient({});
  await client.connect();

  const response = await client.receiveResponseFile(fileName);
  console.log(response);

  await client.disconnect();
});

export default receiveResponse;
