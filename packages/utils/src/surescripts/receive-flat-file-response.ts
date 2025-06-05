#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { out } from "@metriport/core/util/log";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";

const program = new Command();
const { log } = out("surescripts");

program
  .name("receive-ffm")
  .argument("<request>", "The request file name")
  .description("Receive a flat file response from Surescripts")
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

    const response = await client.receiveFlatFileResponse(requestFileName);
    if (!response) {
      log("No response found");
      return;
    }

    log("Response found");
    log(`Response file name: ${response.flatFileResponseName}`);
    log(`Response file size: ${response.flatFileResponseContent.length} bytes`);

    await client.disconnect();
    log("Disconnected from Surescripts");
  });

export default program;
