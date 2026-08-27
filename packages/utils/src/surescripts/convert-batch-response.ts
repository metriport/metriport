#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
import { Command } from "commander";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Converts a Surescripts population response into FHIR bundles for each patient in the population.
 */
const program = new Command();

interface ConvertBatchResponseOptions {
  cxId: string;
  transmissionId: string;
  rosterId: string;
}

program
  .name("convert-batch-response")
  .requiredOption("--cx-id <cxId>", "The customer ID")
  .requiredOption("--transmission-id <transmissionId>", "The transmission ID")
  .requiredOption("--roster-id <rosterId>", "The roster ID")
  .description("Converts a patient or population response to FHIR bundles")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({ cxId, transmissionId, rosterId }: ConvertBatchResponseOptions) {
    await confirm(
      `You are about to convert a Surescripts batch response for cx ${cxId}, ` +
        `transmission ${transmissionId}, roster ${rosterId}.`
    );
    const start = Date.now();
    const handler = new SurescriptsConvertBatchResponseHandlerDirect();
    await handler.convertBatchResponse({
      cxId,
      transmissionId,
      populationId: rosterId,
    });
    const end = Date.now();
    console.log(`Conversion took ${elapsedTimeAsStr(start, end)}`);
  });

export default program;
