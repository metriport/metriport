import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsIngestAllResponsesHandlerDirect } from "@metriport/core/external/surescripts/command/ingest-all-responses/ingest-all-responses-direct";
import { Command } from "commander";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Ingest all new Surescripts responses from the Surescripts SFTP server and uploads them to the Surescripts replica.
 * This triggers the next steps of the data pipeline, which convert the ingested responses to FHIR bundles.
 *
 * Usage:
 * npm run surescripts -- ingest-all-responses
 *
 * To reprocess specific files from the S3 replica (skips SFTP):
 * npm run surescripts -- ingest-all-responses --file-name-overrides "transmissionId_populationId_12345_20250115120000.gz"
 */
const program = new Command();

program
  .name("ingest-all-responses")
  .description("Ingest all available response files from Surescripts.")
  .option(
    "--file-name-overrides <fileNames>",
    "Comma-separated list of file names to reprocess from S3 replica (skips SFTP)"
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({ fileNameOverrides }: { fileNameOverrides?: string }) {
    const overrides = fileNameOverrides?.split(",").map(f => f.trim());
    const source = overrides ? "S3 replica" : "Surescripts SFTP";
    await confirm(`You are about to ingest response files from ${source}.`);
    const start = Date.now();
    const handler = new SurescriptsIngestAllResponsesHandlerDirect(
      new SurescriptsSftpClient({
        logLevel: "debug",
      })
    );
    await handler.ingestAllResponses({ fileNameOverrides: overrides });
    const end = Date.now();
    console.log(`Ingest took ${elapsedTimeAsStr(start, end)}`);
  });

export default program;
