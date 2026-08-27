import { QuestUploadRosterHandlerDirect } from "@metriport/core/external/quest/command/upload-roster/upload-roster-direct";
import { BadRequestError } from "@metriport/shared";
import {
  isValidQuestRosterType,
  QuestRosterType,
} from "@metriport/shared/interface/external/quest/roster";
import { Command } from "commander";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Uploads the latest roster of patients subscribed to Quest monitoring to Quest Diagnostics over SFTP.
 * This operation queries all patients who have monitoring and assigns new external IDs, so it may take
 * up to a minute or two to finish if there were many roster updates.
 *
 * Usage:
 * npm run quest -- upload-roster --roster-type <rosterType> --cx-id <cxId> --roster-id <rosterId>
 *
 * The roster type must be one of the following:
 * - notifications
 * - backfill
 *
 * The customer ID and roster ID are optional and can be used to upload a roster for a specific customer and roster.
 * If both are provided, the roster will be uploaded for the specific customer and roster.
 * If neither are provided, the roster will be uploaded for all customers with the Quest feature flag enabled.
 */
const program = new Command();
program
  .name("upload-roster")
  .requiredOption("--roster-type <rosterType>", "The roster type", "notifications")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--roster-id <rosterId>", "The roster ID")
  .description("Upload latest Quest roster to Quest Diagnostics")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({
    rosterType,
    cxId,
    rosterId,
  }: {
    rosterType: QuestRosterType;
    cxId?: string;
    rosterId?: string;
  }) {
    if (!isValidQuestRosterType(rosterType)) {
      throw new BadRequestError("Invalid roster type", undefined, { rosterType });
    }
    if ((cxId && !rosterId) || (!cxId && rosterId)) {
      throw new BadRequestError("Both cxId and rosterId must be provided together");
    }
    const scope = cxId && rosterId ? `cx ${cxId} (roster: ${rosterId})` : "all customers";
    await confirm(`You are about to upload a Quest ${rosterType} roster for ${scope}.`);
    const start = Date.now();
    const handler = new QuestUploadRosterHandlerDirect();
    await handler.uploadRoster({ rosterType, ...(cxId && rosterId ? { cxId, rosterId } : {}) });
    const end = Date.now();
    console.log(`Upload of Quest roster completed in ${elapsedTimeAsStr(start, end)}`);
  });

export default program;
