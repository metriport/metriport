#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { out } from "@metriport/core/util/log";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";

const program = new Command();
const { log } = out("surescripts");

program
  .name("send-plf")
  .argument("<file>", "The file to send")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async (requestFileName: string) => {
    if (!requestFileName || !requestFileName.startsWith("Metriport_PMA_")) {
      throw new Error("File must start with 'Metriport_PMA_'");
    }

    const client = new SurescriptsSftpClient({});
    log("Connecting to Surescripts...");
    await client.connect();
    log("Connected to Surescripts");

    log("Copying file to Surescripts...");
    await client.copyFileToSurescripts(requestFileName);
    log("Copied file to Surescripts");

    log("Disconnecting from Surescripts...");
    await client.disconnect();
    log("Disconnected from Surescripts");
  });

export default program;
