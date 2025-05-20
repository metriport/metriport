#!/usr/bin/env node
import path from "path";
import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../../../.env"),
});

import { Command } from "commander";
import { SurescriptsSftpClient } from "../client";
import { metriportBanner } from "./shared";
const program = new Command();

program
  .description("Tests a connection to the Surescripts SFTP server")
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  console.log(metriportBanner());
  program.parse();

  const client = new SurescriptsSftpClient({});

  console.log("Connecting to Surescripts SFTP server...");
  await client.connect();
  console.log("Successfully connected to Surescripts SFTP server");

  console.log("Disconnecting from Surescripts SFTP server...");
  await client.disconnect();
  console.log("Successfully disconnected from Surescripts SFTP server");
}

main();
