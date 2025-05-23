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
  .option("-t, --transmission <id>", "Synchronize a specific transmission")
  .description(
    "Ensure one or all files are synchronized between the Surescripts SFTP server and the S3 bucket"
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { dryRun, all, file } = program.opts();

    console.log(all, file);
    const replica = new SurescriptsReplica();
    if (dryRun) {
      await replica.synchronize(dryRun);
    } else if (all) {
      await replica.synchronize(true);
    } else {
      console.log("File", file);
    }
  });

export default program;
