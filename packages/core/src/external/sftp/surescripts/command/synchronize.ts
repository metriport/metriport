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
  .argument("<key>", "The S3 bucket key after the to_surescripts prefix")
  .description(
    "Ensure all files are synchronized between the Surescripts SFTP server and the S3 bucket"
  )
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  console.log(metriportBanner());
  program.parse();

  const client = new SurescriptsSftpClient({});

  await client.connect();

  await client.disconnect();
}

main();
