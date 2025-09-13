import { Command } from "commander";
import { out } from "@metriport/core/util/log";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";

import { writeSurescriptsIdentifiersFile, getPatientIdsFromCsv } from "./shared";
import { SurescriptsPatientRequestData } from "@metriport/core/external/surescripts/types";
import { executeAsynchronously } from "@metriport/core/util/concurrency";

/**
 * Sends a request to Surescripts for all patient IDs in a CSV file. The CSV can have multiple columns,
 * and this script will only operate on the column with header "patientId".
 *
 * Usage:
 * npm run surescripts -- batch-patient-request \
 *  --cx-id <cx-id> \
 *  --facility-id <facility-id> \
 *  --csv-data <csv-data> \
 *  --csv-output <csv-output>
 *
 * cx-id: The CX ID of the requester
 * facility-id: The facility ID of the requester
 * csv-output: The file to write a CSV containing transmission IDs and patient IDs
 *
 * Note: The headers of the CSV output file are "transmission_id","patient_id", which are used in scripts
 * like `convert-customer-responses` to convert the eventual responses from Surescripts into FHIR resources.
 */
const program = new Command();

program
  .name("batch-patient-request")
  .requiredOption("--cx-id <cx>", "The CX ID of the requester")
  .requiredOption("--facility-id <facility>", "The facility ID of the requester")
  .requiredOption("--csv-data <csvData>", "The CSV data")
  .requiredOption("--csv-output <csvOutput>", "The file to write CSV IDs to")
  .description("Send a request to Surescripts for all patient IDs in a CSV file")
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      cxId,
      facilityId,
      csvData,
      csvOutput,
    }: {
      cxId: string;
      facilityId: string;
      csvData: string;
      csvOutput: string;
    }) => {
      const client = new SurescriptsSftpClient({
        logLevel: "info",
      });
      const dataMapper = new SurescriptsDataMapper();
      const { log } = out(`Surescripts sendBatchPatientRequest - cxId ${cxId}`);

      const patientIds = await getPatientIdsFromCsv(csvData);
      log(`Found ${patientIds.length} patients`);

      const requests: SurescriptsPatientRequestData[] = [];
      await executeAsynchronously(
        patientIds,
        async patientId => {
          const requestData = await dataMapper.getPatientRequestData({
            cxId,
            facilityId,
            patientId,
          });
          requests.push(requestData);
        },
        {
          numberOfParallelExecutions: 10,
        }
      );

      log("Sending " + requests.length + " requests");
      const identifiers = await client.sendBatchPatientRequest(requests);
      log("Done writing batch patient requests");
      writeSurescriptsIdentifiersFile(csvOutput, identifiers);
      log(`Wrote ${identifiers.length} identifiers to ${csvOutput}.csv`);
    }
  );

export default program;
