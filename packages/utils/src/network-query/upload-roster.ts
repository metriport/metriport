import { buildQuestUploadRosterHandler } from "@metriport/core/external/quest/command/upload-roster/upload-roster-factory";
import { buildSurescriptsUploadRosterHandler } from "@metriport/core/external/surescripts/command/upload-roster/upload-roster-factory";
import {
  isValidQuestRosterType,
  QuestRosterType,
} from "@metriport/shared/interface/external/quest/roster";
import {
  isValidSurescriptsRosterType,
  SurescriptsRosterType,
} from "@metriport/shared/interface/external/surescripts/roster";
import { Command } from "commander";
import { logAwsRegion } from "./shared";

/**
 * Uploads a roster to the external provider's SFTP server.
 *
 * This must be run from within the VPC (staging or production) because
 * only whitelisted IPs can send files to the external providers.
 *
 * Usage:
 *   Surescripts (cxId required, rosterId optional - uses latest if not provided):
 *     npm run network-query -- upload-roster -s surescripts -c <cxId> -t backfill
 *     npm run network-query -- upload-roster -s surescripts -c <cxId> -r <rosterId> -t backfill
 *
 *   Quest (all customers if no cxId, or specific customer with both cxId and rosterId):
 *     npm run network-query -- upload-roster -s quest -t backfill
 *     npm run network-query -- upload-roster -s quest -c <cxId> -r <rosterId> -t backfill
 *
 * Roster types:
 * - notifications: Regular monitoring roster (daily cadence)
 * - backfill: On-demand backfill roster (created by network query start)
 */
const validSources = ["surescripts", "quest"] as const;
type ValidSource = (typeof validSources)[number];

function isValidSource(source: string): source is ValidSource {
  return validSources.includes(source as ValidSource);
}

const program = new Command();

program
  .name("upload-roster")
  .description("Upload a roster to an external provider (Surescripts or Quest)")
  .requiredOption("-s, --source <source>", `The source provider (${validSources.join(", ")})`)
  .requiredOption("-t, --roster-type <rosterType>", "The roster type (notifications, backfill)")
  .option(
    "-c, --cx-id <cxId>",
    "The customer ID (optional, uploads for all customers if not provided)"
  )
  .option(
    "-r, --roster-id <rosterId>",
    "The roster ID (optional, uses latest roster if not provided)"
  )
  .action(async options => {
    const { source, rosterType, cxId, rosterId } = options;

    if (!isValidSource(source)) {
      throw new Error(`Invalid source: ${source}. Valid sources: ${validSources.join(", ")}`);
    }

    console.log(`Uploading ${source} roster...`);
    console.log(`Roster type: ${rosterType}`);
    if (cxId) console.log(`Customer ID: ${cxId}`);
    if (rosterId) console.log(`Roster ID: ${rosterId}`);
    logAwsRegion();

    const start = Date.now();

    if (source === "surescripts") {
      if (!isValidSurescriptsRosterType(rosterType)) {
        throw new Error(`Invalid Surescripts roster type: ${rosterType}`);
      }
      if (!cxId) {
        throw new Error("Customer ID is required for Surescripts roster upload");
      }
      const handler = buildSurescriptsUploadRosterHandler();
      await handler.uploadRoster({
        cxId,
        rosterType: rosterType as SurescriptsRosterType,
        ...(rosterId ? { rosterId } : {}),
      });
    } else if (source === "quest") {
      if (!isValidQuestRosterType(rosterType)) {
        throw new Error(`Invalid Quest roster type: ${rosterType}`);
      }
      const handler = buildQuestUploadRosterHandler();
      await handler.uploadRoster({
        rosterType: rosterType as QuestRosterType,
        ...(cxId && rosterId ? { cxId, rosterId } : {}),
      });
    }

    const end = Date.now();
    console.log(`Roster upload completed in ${end - start}ms`);
  });

export default program;
