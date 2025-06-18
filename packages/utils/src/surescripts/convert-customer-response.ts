#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { getTransmissionsFromCsv } from "./shared";

const program = new Command();

interface ConvertCustomerResponseOptions {
  cxId?: string;
  facilityId?: string;
  csvData?: string;
}

program
  .name("convert-customer-response")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--csv-data <csvData>", "The CSV data")
  .description("Converts a customer response to FHIR bundles")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({ cxId, facilityId, csvData }: ConvertCustomerResponseOptions) {
    if (!cxId) throw new Error("Customer ID is required");
    if (!facilityId) throw new Error("Facility ID is required");
    if (!csvData) throw new Error("CSV data is required");

    const transmissions = await getTransmissionsFromCsv(cxId, csvData);
    let convertedCount = 0;
    for (const { patientId, transmissionId } of transmissions) {
      const handler = new SurescriptsConvertPatientResponseHandlerDirect(new SurescriptsReplica());
      await handler.convertPatientResponse({
        cxId,
        facilityId,
        transmissionId,
        populationId: patientId,
      });
      convertedCount++;
      if (convertedCount % 100 === 0) {
        console.log(`Converted ${convertedCount} patients`);
      }
    }
    console.log(`Converted ${convertedCount} patients`);
  });

export default program;
