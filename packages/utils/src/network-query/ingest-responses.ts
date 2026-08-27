import { buildIngestAllResponsesHandler as buildQuestIngestAllResponsesHandler } from "@metriport/core/external/quest/command/ingest-all-responses/ingest-all-responses-factory";
import { buildIngestAllResponsesHandler as buildSurescriptsIngestAllResponsesHandler } from "@metriport/core/external/surescripts/command/ingest-all-responses/ingest-all-responses-factory";
import { Command } from "commander";
import { logAwsRegion } from "./shared";

/**
 * Ingests response files from an external provider's SFTP server.
 *
 * This downloads response files from the provider and triggers the next steps
 * of the data pipeline (conversion to FHIR bundles, etc.).
 *
 * Usage:
 * npm run network-query -- ingest-responses -s surescripts
 * npm run network-query -- ingest-responses -s quest
 * npm run network-query -- ingest-responses -s quest --remote-files file1.txt file2.txt
 */

const validSources = ["surescripts", "quest"] as const;
type ValidSource = (typeof validSources)[number];

function isValidSource(source: string): source is ValidSource {
  return validSources.includes(source as ValidSource);
}

const program = new Command();
program
  .name("ingest-responses")
  .description("Ingest response files from an external provider (Surescripts or Quest)")
  .requiredOption("-s, --source <source>", `The source provider (${validSources.join(", ")})`)
  .option("--remote-files <remoteFiles...>", "Remote file names to ingest (only valid for quest)")
  .action(async options => {
    const { source, remoteFiles } = options;

    if (!isValidSource(source)) {
      throw new Error(`Invalid source: ${source}. Valid sources: ${validSources.join(", ")}`);
    }

    if (remoteFiles && source !== "quest") {
      throw new Error("--remote-files is only supported for quest source");
    }

    console.log(`Ingesting ${source} responses...`);
    if (remoteFiles) {
      console.log(`Using remote files: ${remoteFiles.join(", ")}`);
    }
    logAwsRegion();

    const start = Date.now();

    if (source === "surescripts") {
      const handler = buildSurescriptsIngestAllResponsesHandler();
      await handler.ingestAllResponses();
    } else if (source === "quest") {
      const handler = buildQuestIngestAllResponsesHandler();
      await handler.ingestAllResponses({ fileNameOverrides: remoteFiles });
    }

    const end = Date.now();
    console.log(`Response ingestion completed in ${end - start}ms`);
  });

export default program;
