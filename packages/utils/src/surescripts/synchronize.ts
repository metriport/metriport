#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsReplica } from "@metriport/core/external/sftp/surescripts/replica";
const program = new Command();

program
  .name("synchronize")
  .option("-d, --dry-run", "Dry run the synchronization")
  .option("-a, --all", "Synchronize all files")
  .option("-f, --file <file>", "Synchronize a specific file")
  .description(
    "Ensure one or all files are synchronized between the Surescripts SFTP server and the S3 bucket"
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { dryRun } = program.opts();

    const replica = new SurescriptsReplica();
    await replica.synchronize("from_surescripts", dryRun);
    await replica.synchronize("to_surescripts", dryRun);
  });

export default program;
