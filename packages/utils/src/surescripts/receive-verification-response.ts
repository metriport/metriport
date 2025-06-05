#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { out } from "@metriport/core/util/log";

const program = new Command();
const { log } = out("surescripts");

program
  .name("receive-vfr")
  .argument("<transferId>", "The transfer ID")
  .description("Receive a verification response from Surescripts")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async (requestFileName: string) => {
    if (!requestFileName) {
      throw new Error("Request file name is required");
    }
    log(`Checking for request file name: ${requestFileName}`);

    const client = new SurescriptsSftpClient({});
    await client.connect();
    log("Connected to Surescripts");

    const response = await client.receiveVerificationResponse(requestFileName);
    if (response) {
      log("Response found");
      log(`Response file name: ${response.verificationFileName}`);
      log(`Response file size: ${response.verificationFileContent.length} bytes`);
    } else {
      log("No response found");
    }

    await client.disconnect();
    log("Disconnected from Surescripts");
  });

export default program;
