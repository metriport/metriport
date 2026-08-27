#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { BadRequestError } from "@metriport/shared";
import {
  isValidSurescriptsRosterType,
  SurescriptsRosterType,
} from "@metriport/shared/interface/external/surescripts/roster";
import { Command } from "commander";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Converts a Surescripts population response into FHIR bundles for each patient in the population.
 */
const program = new Command();

interface ConvertPatientResponseOptions {
  cxId: string;
  transmissionId: string;
  rosterId: string;
  patientId: string;
  rosterType: SurescriptsRosterType;
}

program
  .name("convert-patient-response")
  .requiredOption("--cx-id <cxId>", "The customer ID")
  .requiredOption("--patient-id <patientId>", "The patient ID")
  .requiredOption("--transmission-id <transmissionId>", "The transmission ID")
  .requiredOption("--roster-id <rosterId>", "The roster ID")
  .requiredOption("--roster-type <rosterType>", "The roster type")
  .description("Converts a Surescripts patient response to FHIR bundles")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({
    cxId,
    patientId,
    transmissionId,
    rosterId,
    rosterType,
  }: ConvertPatientResponseOptions) {
    if (!isValidSurescriptsRosterType(rosterType)) {
      throw new BadRequestError("Invalid roster type", undefined, { rosterType });
    }
    await confirm(
      `You are about to convert a Surescripts patient response for cx ${cxId}, ` +
        `patient ${patientId}, transmission ${transmissionId}, roster ${rosterId}, roster type ${rosterType}.`
    );
    const start = Date.now();
    const handler = new SurescriptsConvertPatientResponseHandlerDirect();
    await handler.convertPatientResponse({
      cxId,
      patientId,
      transmissionId,
      populationId: rosterId,
      rosterType,
    });
    const end = Date.now();
    console.log(`Conversion took ${elapsedTimeAsStr(start, end)}`);
  });

export default program;
