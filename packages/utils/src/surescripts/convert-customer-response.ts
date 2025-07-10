#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { buildCsvPath, getTransmissionsFromCsv } from "./shared";
import { buildLatestConversionBundleFileName } from "@metriport/core/external/surescripts/file/file-names";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { executeAsynchronously } from "@metriport/core/util";

const program = new Command();

interface ConvertCustomerResponseOptions {
  cxId?: string;
  facilityId?: string;
  csvData?: string;
  start?: string;
  end?: string;
  recreate?: boolean;
}

program
  .name("convert-customer-response")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--csv-data <csvData>", "The CSV data")
  .option("--recreate", "Recreate the consolidated bundle")
  .option("--start <start>", "Start at index")
  .option("--end <end>", "end before index")
  .description("Converts a customer response to FHIR bundles")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({
    cxId,
    facilityId,
    csvData,
    start,
    end,
    recreate,
  }: ConvertCustomerResponseOptions) {
    if (!cxId) throw new Error("Customer ID is required");
    if (!facilityId) throw new Error("Facility ID is required");
    if (!csvData) throw new Error("CSV data is required");
    csvData = buildCsvPath(csvData);

    let transmissions = await getTransmissionsFromCsv(cxId, csvData);
    if (start != null || end != null) {
      const startIndex = parseInt(start ?? "0");
      const endIndex = end != null ? parseInt(end) : undefined;
      transmissions = transmissions.slice(startIndex, endIndex);
      console.log(`Got ${transmissions.length} transmissions from ${startIndex} to ${endIndex}`);
    }

    let convertedCount = 0;
    const handler = new SurescriptsConvertPatientResponseHandlerDirect();
    for (const { patientId, transmissionId } of transmissions) {
      await handler.convertPatientResponse({
        cxId,
        facilityId,
        transmissionId,
        populationId: patientId,
      });
      console.log(`Key: ${buildLatestConversionBundleFileName(cxId, patientId)}`);
      convertedCount++;
      if (convertedCount % 100 === 0) {
        console.log(`Converted ${convertedCount} patients`);
      }
    }
    console.log(`Converted ${convertedCount} patients`);

    if (recreate) {
      console.log(`Recreating consolidated bundles for ${transmissions.length} patients`);
      const dataMapper = new SurescriptsDataMapper();
      let recreatedCount = 0;
      await executeAsynchronously(transmissions, async ({ patientId }) => {
        try {
          const result = await dataMapper.recreateConsolidatedBundle(cxId, patientId);
          console.log(
            `Recreated consolidated bundle for ${patientId} with request ID ${result.requestId}`
          );
          recreatedCount++;
        } catch (error) {
          console.error(`Error recreating consolidated bundle for ${patientId}: ${error}`);
        }
      });
      console.log(`Recreated ${recreatedCount} consolidated bundles`);
    }
  });

export default program;
