import { Command } from "commander";
import { SurescriptsReceiveAllHandlerDirect } from "@metriport/core/external/surescripts/command/receive-all/receive-all-direct";

/**
 * Downloads all new Surescripts responses from the Surescripts SFTP server and uploads them to the Surescripts replica.
 * This triggers the next steps of the data pipeline, which convert the downloaded responses to FHIR bundles.
 *
 * Usage:
 * npm run surescripts -- download-responses
 */
const command = new Command();
command.name("receive-all");
command.option(
  "--max-responses <maxResponses>",
  "The maximum number of responses to receive",
  "10"
);
command.description("Receive all new Surescripts responses");
command.action(async ({ maxResponses }: { maxResponses?: number }) => {
  const handler = new SurescriptsReceiveAllHandlerDirect();
  await handler.receiveAllNewResponses({ maxResponses });
});
