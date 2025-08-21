import { Command } from "commander";
import { DownloadResponseHandlerDirect } from "@metriport/core/external/quest/command/download-response/download-response-direct";

/**
 * Downloads all Quest responses from the Quest SFTP server and uploads them to the Quest replica. This currently does not
 * perform the FHIR conversion, and in the subsequent update (ENG-864) this comment will be updated to reflect what this
 * script *should do* (reconvert to FHIR with all patients who have Quest updates).
 *
 * npm run quest -- download-response
 */
const program = new Command();

program
  .command("download-response")
  .description("Download Quest responses")
  .action(async () => {
    console.log("Downloading Quest responses...");
    const handler = new DownloadResponseHandlerDirect();
    await handler.downloadAllQuestResponses();
    console.log("Quest responses downloaded successfully");
  });

export default program;
