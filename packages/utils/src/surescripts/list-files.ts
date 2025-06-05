#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
const program = new Command();

program
  .name("ls")
  .description("Lists files in the Surescripts SFTP server")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const client = new SurescriptsSftpClient({});
    await client.connect();
    const files = await client.listAllFilesInSurescripts();
    await client.disconnect();

    const directories = Object.keys(files) as Array<keyof typeof files>;
    for (const directory of directories) {
      console.log(directory + "/");
      const fileNames = files[directory];
      for (const fileName of fileNames) {
        console.log(`|-- ${fileName}`);
      }
    }
  });

export default program;
