#!/usr/bin/env node
/* eslint-disable no-param-reassign */
import dotenv from "dotenv";
dotenv.config();

import { SurescriptsUploadRosterHandlerDirect } from "@metriport/core/external/surescripts/command/upload-roster/upload-roster-direct";
import { BadRequestError } from "@metriport/shared";
import {
  isValidSurescriptsRosterType,
  SurescriptsRosterType,
} from "@metriport/shared/interface/external/surescripts/roster";
import { Command } from "commander";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * This script is used to send a batch request to Surescripts by either providing a roster ID or a CSV file.
 * It must be run from within the corresponding VPC (staging or production), otherwise you will generate a valid request
 * file but it will not be received by Surescripts since only a very specific IP set is whitelisted for requests. See 1PW.
 *
 * Usage with roster ID:
 * npm run surescripts -- upload-roster --cx-id <cx-id> --roster-id <roster-id> --roster-type <roster-type>
 *
 * The roster ID should be a UUID of a roster that has been created in the OSS database. The Surescripts client automatically validates that the roster is valid and belongs to the given customer.
 *
 * The roster type must be one of the following:
 * - notifications
 * - backfill
 *
 * The CX ID and roster ID are optional and can be used to upload a roster for a specific customer and roster.
 * If only the CX ID is provided, the latest roster will be uploaded for the given customer.
 */
const program = new Command();

program
  .name("upload-roster")
  .requiredOption("--roster-type <rosterType>", "The roster type", "notifications")
  .requiredOption("--cx-id <cx>", "The CX ID of the requester")
  .option("--roster-id <roster>", "The roster ID for the request")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      rosterType,
      cxId,
      rosterId,
    }: {
      rosterType: SurescriptsRosterType;
      cxId: string;
      rosterId?: string;
    }) => {
      if (!isValidSurescriptsRosterType(rosterType)) {
        throw new BadRequestError("Invalid roster type", undefined, { rosterType });
      }
      await confirm(
        `You are about to upload a Surescripts ${rosterType} roster for cx ${cxId}` +
          (rosterId ? ` (roster: ${rosterId})` : "") +
          "."
      );
      const start = Date.now();
      const handler = new SurescriptsUploadRosterHandlerDirect();
      await handler.uploadRoster({
        rosterType,
        cxId,
        ...(rosterId ? { rosterId } : {}),
      });
      const end = Date.now();
      console.log(`Upload of Surescripts roster completed in ${elapsedTimeAsStr(start, end)}`);
    }
  );

export default program;
