#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";

const program = new Command();

program
  .name("send-plf")
  .argument("<file>", "The file to send")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async (file: string) => {
    if (!file || !file.startsWith("Metriport_PMA_")) {
      throw new Error("File must start with 'Metriport_PMA_'");
    }

    const client = new SurescriptsSftpClient({});
    client.sendPatientLoadFileByName(file);
    console.log("Sent patient load file");
  });

export default program;
