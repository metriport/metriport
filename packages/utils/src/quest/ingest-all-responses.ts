import { QuestSftpClient } from "@metriport/core/external/quest/client";
import { QuestIngestAllResponsesHandlerDirect } from "@metriport/core/external/quest/command/ingest-all-responses/ingest-all-responses-direct";
import { Command } from "commander";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Ingest all available response files from Quest Diagnostics.
 *
 * Usage:
 * npm run quest -- ingest-all-responses
 *
 * To reprocess specific files from the S3 replica (skips SFTP):
 * npm run quest -- ingest-all-responses --file-name-overrides "Metriport_202501010102.txt,Metriport_MIPE_202501030104.txt"
 */
const program = new Command();

program
  .name("ingest-all-responses")
  .description("Ingest all available response files from Quest Diagnostics.")
  .option(
    "--file-name-overrides <fileNames>",
    "Comma-separated list of file names to reprocess from S3 replica (skips SFTP)"
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({ fileNameOverrides }: { fileNameOverrides?: string }) {
    const overrides = fileNameOverrides?.split(",").map(f => f.trim());
    const source = overrides ? "S3 replica" : "Quest SFTP";
    await confirm(`You are about to ingest response files from ${source}.`);
    const start = Date.now();
    const handler = new QuestIngestAllResponsesHandlerDirect(
      new QuestSftpClient({
        logLevel: "debug",
      })
    );
    await handler.ingestAllResponses({ fileNameOverrides: overrides });
    const end = Date.now();
    console.log(`Ingest took ${elapsedTimeAsStr(start, end)}`);
  });

export default program;
