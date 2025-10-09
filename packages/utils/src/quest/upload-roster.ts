import { Command } from "commander";
import { QuestUploadRosterHandlerDirect } from "@metriport/core/external/quest/command/upload-roster/upload-roster-direct";
import { QuestSftpClient } from "@metriport/core/external/quest/client";

/**
 * Uploads the latest roster of patients subscribed to Quest monitoring to Quest Diagnostics over SFTP.
 * This operation queries all patients who have monitoring and assigns new external IDs, so it may take
 * up to a minute or two to finish if there were many roster updates.
 *
 * npm run quest -- upload-roster
 */
const command = new Command();
command.name("upload-roster");
command.option("--notifications", "Upload roster for real time notifications");
command.description("Upload latest Quest roster to Quest Diagnostics");

command.action(async ({ notifications }: { notifications?: boolean | undefined }) => {
  console.log("Uploading latest Quest roster to Quest Diagnostics...");
  console.log(
    notifications
      ? "Uploading roster for real time notifications"
      : "Uploading roster for historical data"
  );
  const client = new QuestSftpClient({ logLevel: "debug" });
  const rosterType = notifications ? "notifications" : "backfill";
  const handler = new QuestUploadRosterHandlerDirect(client);
  await handler.generateAndUploadLatestQuestRoster({ rosterType });
  console.log("Upload of Quest roster completed");
});

export default command;
