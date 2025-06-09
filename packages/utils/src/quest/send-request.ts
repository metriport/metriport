import { Command } from "commander";
import { QuestSftpClient } from "@metriport/core/external/quest/client";

const sendRequest = new Command();
sendRequest.name("send");
sendRequest.argument("<file>", "The name of the file to send from the replica");

sendRequest.action(async (fileName: string) => {
  const client = new QuestSftpClient({});
  await client.connect();

  console.log("TODO: Send request to Quest: " + fileName);

  await client.disconnect();
});

export default sendRequest;
