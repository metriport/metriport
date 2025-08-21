import { Command } from "commander";
import { QuestUploadRosterHandlerDirect } from "@metriport/core/external/quest/command/upload-roster/upload-roster-direct";

/**
 * Uploads the latest roster of patients subscribed to Quest monitoring to Quest Diagnostics over SFTP.
 * This operation queries all patients who have monitoring and assigns new external IDs, so it may take
 * up to a minute or two to finish if there were many roster updates.
 *
 * npm run quest -- upload-roster
 */
const command = new Command();
command.name("upload-roster");
command.description("Upload latest Quest roster to Quest Diagnostics");

command.action(async () => {
  console.log("Uploading latest Quest roster to Quest Diagnostics...");
  const handler = new QuestUploadRosterHandlerDirect();
  await handler.generateAndUploadLatestQuestRoster();
  console.log("Upload of Quest roster completed");
});

export default command;
