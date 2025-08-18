#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { buildCsvPath, getTransmissionsFromCsv } from "./shared";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { executeAsynchronously } from "@metriport/core/util/concurrency";

/**
 * Converts all patient responses for a customer transmission to FHIR bundles.
 *
 * Usage:
 * npm run surescripts -- convert-customer-response \
 *  --cx-id "acme-uuid-1234-sadsjksl" \
 *  --facility-id "facility-uuid-7890-asdkjkds" \
 *  --csv-data "acme-roster.csv"
 *
 * cx-id: The CX ID to perform reconversion.
 * facility-id: The facility ID to perform reconversion.
 * csv-data: A CSV file with two columns: "patient_id" and "transmission_id". This file can be automatically generated
 * using the `generate-csv` command.
 *
 * @see generate-csv.ts for more details on how to generate a CSV of all patient IDs for batch reconversion.
 */
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

    const conversionStart = Date.now();
    let convertedCount = 0;
    const handler = new SurescriptsConvertPatientResponseHandlerDirect();
    await executeAsynchronously(
      transmissions,
      async ({ patientId, transmissionId }) => {
        console.log(`Converting patient ${patientId} with transmission ${transmissionId}`);
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
      },
      {
        numberOfParallelExecutions: 10,
        keepExecutingOnError: true,
      }
    );
    console.log(
      `Converted ${convertedCount} patients in ${((Date.now() - conversionStart) / 1000).toFixed(
        1
      )} seconds`
    );

    if (recreate) {
      console.log(`Recreating consolidated bundles for ${transmissions.length} patients`);
      const dataMapper = new SurescriptsDataMapper();
      let recreatedCount = 0;
      await executeAsynchronously(
        transmissions,
        async ({ patientId }) => {
          try {
            const result = await dataMapper.recreateConsolidatedBundle(cxId, patientId);
            console.log(
              `Recreated consolidated bundle for ${patientId} with request ID ${result.requestId}`
            );
            recreatedCount++;
          } catch (error) {
            console.error(`Error recreating consolidated bundle for ${patientId}: ${error}`);
          }
        },
        {
          numberOfParallelExecutions: 10,
          keepExecutingOnError: true,
        }
      );
      console.log(`Recreated ${recreatedCount} consolidated bundles`);
    }
  });

export default program;
