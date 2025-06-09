#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { QuestSftpClient } from "@metriport/core/external/quest/client";

const sftpAction = new Command();
sftpAction.name("sftp");

// Create child commands for each SFTP action
const sftpConnect = new Command();
const sftpListFiles = new Command();
const sftpReadFile = new Command();
sftpAction.addCommand(sftpConnect);
sftpAction.addCommand(sftpListFiles);
sftpAction.addCommand(sftpReadFile);

sftpConnect
  .name("connect")
  .description("Tests a connection to the Quest SFTP server")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const client = new QuestSftpClient({});
    console.log("Connecting to Quest SFTP server...");
    await client.connect();
    console.log("Successfully connected to Quest SFTP server");

    console.log("Disconnecting from Quest SFTP server...");
    await client.disconnect();
    console.log("Successfully disconnected from Quest SFTP server");
  });

sftpListFiles
  .name("list")
  .description("Lists files on the Quest SFTP server")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const client = new QuestSftpClient({});
    await client.connect();

    const { incoming, outgoing } = await client.listSftpFiles();
    console.log("/OUT (from_quest)");
    console.log("|-- " + outgoing.join("\n|-- "));
    console.log("/IN (to_quest)");
    console.log("|-- " + incoming.join("\n|-- "));

    await client.disconnect();
  });

sftpReadFile
  .name("read")
  .argument("<file>", "The full path to the remote file to read")
  .description("Reads a file from the Quest SFTP server")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async (fileName: string) => {
    const client = new QuestSftpClient({});
    await client.connect();
    const file = await client.read(fileName);
    console.log(file);
    await client.disconnect();
  });

export default sftpAction;
