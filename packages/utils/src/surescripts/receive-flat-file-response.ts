#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
const program = new Command();

// import { getFacilities } from "@metriport/api/command/medical/facility/get-facility";

program
  .name("receive-ffm")
  .argument("<transferId>", "The transfer ID")
  .description("Receive a flat file response from Surescripts")
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
