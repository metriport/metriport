#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
const program = new Command();

program
  .name("read")
  .argument("<fileName>", "The file to read")
  .option("-d, --decompress", "Decompress the file")
  .description("Reads a file from the Surescripts SFTP server and displays its contents")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async (fileName: string) => {
    const { decompress } = program.opts();
    const client = new SurescriptsSftpClient({});
    await client.connect();
    const content = await client.readFileContentsFromSurescripts(fileName, !!decompress);
    await client.disconnect();

    if (content != undefined) {
      console.log("Contents of " + fileName + "");
      console.log("--------------------------------");
      console.log(content);
    } else {
      console.log("File does not exist in SFTP: " + fileName);
    }
  });

export default program;
