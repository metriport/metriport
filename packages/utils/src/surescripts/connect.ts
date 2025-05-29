#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
const program = new Command();

program
  .name("connect")
  .description("Tests a connection to the Surescripts SFTP server")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const client = new SurescriptsSftpClient({});
    console.log("Connecting to Surescripts SFTP server...");
    await client.connect();
    console.log("Successfully connected to Surescripts SFTP server");

    console.log("Disconnecting from Surescripts SFTP server...");
    await client.disconnect();
    console.log("Successfully disconnected from Surescripts SFTP server");
  });

export default program;
