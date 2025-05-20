#!/usr/bin/env node
import path from "path";
import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../../../.env"),
});

import { Command } from "commander";
import { SurescriptsReplica } from "../replica";
import { metriportBanner } from "./shared";
const program = new Command();

program
  .option("-d, --dry-run", "Dry run the synchronization")
  .option("-a, --all", "Synchronize all files")
  .option("-f, --file <file>", "Synchronize a specific file")
  .description(
    "Ensure one or all files are synchronized between the Surescripts SFTP server and the S3 bucket"
  )
  .addHelpText("before", metriportBanner())
  .showHelpAfterError()
  .version("1.0.0");

async function main() {
  console.log(metriportBanner());
  program.parse();

  const { dryRun } = program.opts();

  const replica = new SurescriptsReplica();
  await replica.synchronize("from_surescripts", dryRun);
  await replica.synchronize("to_surescripts", dryRun);
}

main();
