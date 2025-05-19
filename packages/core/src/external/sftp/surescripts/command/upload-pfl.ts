#!/usr/bin/env node
import path from "path";
import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../../../.env"),
});

import { Command } from "commander";
import { SurescriptsSftpClient } from "../client";
// import { toSurescriptsMessage } from "../message";
import { metriportBanner } from "./shared";
const program = new Command();

program
  .argument("<key>", "The S3 bucket key after the to_surescripts prefix")
  .description("Upload a PFL file from the S3 location to the SFTP server")
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  console.log(metriportBanner());
  program.parse();

  // const key = program.args[0];

  const client = new SurescriptsSftpClient({});

  await client.connect();

  await client.disconnect();
}

main();
