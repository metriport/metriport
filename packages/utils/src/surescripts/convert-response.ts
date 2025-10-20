#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";

const program = new Command();

interface ConvertResponseOptions {
  cxId?: string;
  facilityId?: string;
  transmissionId?: string;
  populationId?: string;
  patientId?: string;
}

program
  .name("convert-response")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--transmission-id <transmissionId>", "The transmission ID")
  .option("--patient-id <patientId>", "The patient ID")
  .option("--population-id <populationId>", "The population or patient ID")
  .description("Converts a patient or population response to FHIR bundles")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({
    cxId,
    facilityId,
    transmissionId,
    populationId,
    patientId,
  }: ConvertResponseOptions) {
    if (!cxId) throw new Error("Customer ID is required");
    if (!facilityId) throw new Error("Facility ID is required");
    if (!transmissionId) throw new Error("Transmission ID is required");
    if (!populationId && !patientId) throw new Error("Population ID or patient ID is required");

    const handler = new SurescriptsConvertBatchResponseHandlerDirect(new SurescriptsReplica());
    const start = Date.now();
    await handler.convertBatchResponse({
      cxId,
      facilityId,
      transmissionId,
      populationId: populationId ?? patientId ?? "",
    });
    const end = Date.now();
    console.log(`Conversion took ${end - start} ms`);
  });

export default program;
