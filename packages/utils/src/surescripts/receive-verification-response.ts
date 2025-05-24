#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
// import { SurescriptsSftpClient } from "@metriport/core/external/sftp/surescripts/client";
const program = new Command();

program
  .name("receive-vfr")
  .argument("<transferId>", "The transfer ID")
  .description("Receive a verification response from Surescripts")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const transferId = program.args[0];
    if (!transferId) {
      throw new Error("Transfer ID is required");
    }
    console.log(`Checking for transfer ID: ${transferId}`);
  });

export default program;
