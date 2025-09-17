import { Command } from "commander";
import { out } from "@metriport/core/util/log";
// import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
// import { writeSurescriptsIdentifiersFile, getPatientIdsFromCsv } from "./shared";

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
    }: {
      cxId: string;
      batchSizeString?: string;
      csvOutput: string;
    }) => {
      const batchSize = parseInt(batchSizeString ?? "100");
      if (isNaN(batchSize)) {
        throw new Error("Batch size must be a number");
      }

      const dataMapper = new SurescriptsDataMapper();
      const { log } = out(`Surescripts sendCustomerRequest - cxId ${cxId}`);

      const batchRequests = await dataMapper.getBatchRequestDataByFacility(cxId, batchSize);
      const facilityIds = Object.keys(batchRequests);
      log(`Customer has ${facilityIds.length} facilities`);
      console.log(batchRequests);

      // for (const facilityId in facilityIds) {
      //   const batches = batchRequests[facilityId];

      //   // log(`There are ${ batches.length } batches for facility ${facilityId}`);
      //   // console.log(batches[0])
      // }
    }
  );

export default program;
