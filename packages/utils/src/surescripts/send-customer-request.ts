import { Command } from "commander";
import { out } from "@metriport/core/util/log";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import {
  getSurescriptsRunsFilePath,
  writeSurescriptsRunsFile,
  appendToSurescriptsRunsFile,
} from "./shared";

/**
 * Sends a request for all patients of the given customer, batching requests by facility. This is the preferred method
 * to accurately send a backfill request to Surescripts for all patients with the minimum number of SFTP transactions.
 *
 * Usage:
 * npm run surescripts -- customer-request --cx-id <cx-id> --csv-output <csv-output> --batch-size <batch-size>
 *
 * cx-id: The CX ID of the requester
 * csv-output: The file to write CSV IDs to
 * batch-size: The maximum number of patients per batch request - defaults to 100
 *
 * Example:
 * npm run surescripts -- customer-request --cx-id "acme-uuid-1234-sadsjksl" --csv-output "acme-roster.csv" --batch-size 100
 *
 * Note: The headers of the CSV output file are "facility_id","transmission_id","patient_id", which are used in scripts
 * like `convert-customer-responses` to convert the eventual responses from Surescripts into FHIR resources.
 */
const program = new Command();

program
  .name("customer-request")
  .requiredOption("--cx-id <cx>", "The CX ID of the requester")
  .requiredOption("--csv-output <csvOutput>", "The file to write CSV IDs to")
  .option("--batch-size <batchSize>", "The maximum number of patients per batch request", "100")
  .description(
    "Send a request to Surescripts for all patients of the given customer, batched by facility"
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      cxId,
      batchSizeString,
      csvOutput,
    }: {
      cxId: string;
      batchSizeString?: string;
      csvOutput: string;
    }) => {
      const batchSize = parseInt(batchSizeString ?? "100");
      if (!Number.isFinite(batchSize)) {
        throw new Error("Batch size must be a number");
      }
      const { log } = out(`Surescripts sendCustomerRequest - cxId ${cxId}`);
      const dataMapper = new SurescriptsDataMapper();
      const batchRequests = await dataMapper.getBatchRequestDataByFacility(cxId, batchSize);
      log(`Sending ${batchRequests.length} batch requests`);

      const csvOutputPath = getSurescriptsRunsFilePath(csvOutput);
      writeSurescriptsRunsFile(csvOutputPath, `"facility_id","transmission_id","patient_id"\n`);
      let totalRequestedPatients = 0;
      let totalBatches = 0;
      for (const batchRequest of batchRequests) {
        const facilityId = batchRequest.facility.id;

        // Create a new client for each batch request
        const client = new SurescriptsSftpClient({
          logLevel: "info",
        });
        const identifiers = await client.sendBatchRequest(batchRequest);
        if (!identifiers) {
          log(`No patients requested for facility ${facilityId}`);
          continue;
        }

        const transmissionId = identifiers.transmissionId;
        log(
          `Sent ${identifiers.requestedPatientIds.length} patients for facility ${facilityId} (${transmissionId})`
        );
        totalRequestedPatients += identifiers.requestedPatientIds.length;
        totalBatches++;

        // Add each patient ID along with the batch transmission ID to the CSV output for later use in converting responses
        for (const patientId of identifiers.requestedPatientIds) {
          appendToSurescriptsRunsFile(
            csvOutputPath,
            `"${facilityId}","${transmissionId}","${patientId}"\n`
          );
        }
      }
      log(`Sent ${totalBatches} batch requests`);
      log(`Wrote ${totalRequestedPatients} request identifiers to ${csvOutputPath}`);
    }
  );

export default program;
