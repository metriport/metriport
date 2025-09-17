import { Command } from "commander";
import { out } from "@metriport/core/util/log";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { writeSurescriptsRunsFile, appendToSurescriptsRunsFile } from "./shared";

/**
 * Sends a request for all patients of the given customer, batching requests by facility. This is the preferred method
 * to accurately send a backfill request to Surescripts for all patients with the minimum number of SFTP transactions.
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
      const facilityIds = Object.keys(batchRequests);
      log(`Customer has ${facilityIds.length} facilities`);

      const client = new SurescriptsSftpClient({
        logLevel: "info",
      });

      const csvOutputPath = writeSurescriptsRunsFile(
        csvOutput + ".csv",
        `"facility_id","transmission_id","patient_id"\n`
      );
      let totalRequestedPatients = 0;

      for (const facilityId of facilityIds) {
        const batchesForFacility = batchRequests[facilityId];
        if (!Array.isArray(batchesForFacility)) {
          log(`No batches for facility ${facilityId}`);
          continue;
        }

        for (const batchRequest of batchesForFacility) {
          const identifiers = await client.sendBatchRequest(batchRequest);
          if (!identifiers) {
            log(`No identifiers sent for facility ${facilityId}`);
            continue;
          }

          log(`Sent ${identifiers.requestedPatientIds.length} patients for facility ${facilityId}`);
          totalRequestedPatients += identifiers.requestedPatientIds.length;

          // Add each patient ID along with the batch transmission ID to the CSV output for later use in converting responses
          for (const patientId of identifiers.requestedPatientIds) {
            appendToSurescriptsRunsFile(
              csvOutputPath,
              `"${facilityId}","${identifiers.transmissionId}","${patientId}"\n`
            );
          }
        }
      }
      log(`Wrote ${totalRequestedPatients} request identifiers to ${csvOutputPath}`);
    }
  );

export default program;
