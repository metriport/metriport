#!/usr/bin/env node
import * as dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import ingestResponses from "./ingest-responses";
import start from "./start";
import status from "./status";
import uploadRoster from "./upload-roster";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Config } from "@metriport/core/util/config";

/**
 * Network Query CLI - Manual testing tool for network query flow
 *
 * This CLI allows you to manually trigger each touchpoint in the network query flow
 * for E2E testing purposes. The network query flow has these steps:
 *
 * FLOW OVERVIEW:
 * 1. `start` - Creates a network query and kicks off document queries for each source (hie, pharmacy, lab).
 *              For roster-based sources (pharmacy/lab), this adds patients to a backfill roster.
 * 2. `upload-roster` - Uploads a roster to the external provider (Surescripts or Quest).
 *                      This is normally triggered by a scheduled job but can be manually invoked.
 * 3. `ingest-responses` - Ingests response files from the external provider's SFTP server.
 *                         This is normally triggered by a scheduled job but can be manually invoked.
 *
 * E2E TESTING GUIDE:
 * ===================
 * To test the full network query flow from start to finish:
 *
 * 1. Start a network query for a patient:
 *    npm run network-query -- start -p <patientId> -s pharmacy,lab
 *
 * 2. Upload the roster for the source (must be run from within VPC):
 *    npm run network-query -- upload-roster -s surescripts -c <cxId> -t backfill
 *    npm run network-query -- upload-roster -s quest -c <cxId> -t backfill
 *
 * 3. Wait for the external provider to process the roster and return responses.
 *
 * 4. Ingest responses from the external provider:
 *    npm run network-query -- ingest-responses -s surescripts
 *    npm run network-query -- ingest-responses -s quest
 *
 * 5. Check the network query status:
 *    npm run network-query -- status -r <requestId>
 *
 * NOTES:
 * - The `upload-roster` command must be run from within the staging/prod VPC (whitelisted IPs only).
 * - For HIE sources, the flow is different (direct requests via Carequality/Commonwell).
 * - Environment variables required: API_URL, API_KEY (for start/status commands)
 */
const program = new Command();
FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

program
  .name("network-query")
  .description("CLI for testing network query flow E2E")
  .version("1.0.0");

program.addCommand(start);
program.addCommand(uploadRoster);
program.addCommand(ingestResponses);
program.addCommand(status);

program.parse();
