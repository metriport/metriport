#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
const program = new Command();

program
  .name("synchronize")
  .option("-d, --dry-run", "Dry run the synchronization")
  .option("--from-surescripts", "Synchronize all incoming files")
  .option("--to-surescripts", "Synchronize all outgoing files")
  .option("--file-name <fileName>", "Check the status of a specific file")
  .option("--cx-id <cxId>", "The CX ID to check the status of")
  .option("--timestamp <timestamp>", "The timestamp for the file to check the status of")
  .description(
    "Ensure one or all files are synchronized between the Surescripts SFTP server and the S3 bucket"
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    console.log("Synchronizing with Surescripts...");
    const { dryRun, fromSurescripts, toSurescripts, fileName, cxId, timestamp } = program.opts<{
      dryRun: boolean;
      fromSurescripts: boolean;
      toSurescripts: boolean;
      fileName: string;
      cxId: string;
      timestamp: string;
    }>();

    if (fileName && (!cxId || !timestamp || Number.isNaN(Number.parseInt(timestamp)))) {
      throw new Error(
        "CX ID and timestamp are required when checking the status of a specific file"
      );
    }

    const client = new SurescriptsSftpClient({});
    await client.connect();
    await client.synchronize({
      dryRun,
      fromSurescripts,
      toSurescripts,
      ...(fileName
        ? {
            checkFileStatus: {
              fileName,
              cxId,
              timestamp: Number.parseInt(timestamp),
            },
          }
        : null),
    });
    await client.disconnect();
  });

export default program;
