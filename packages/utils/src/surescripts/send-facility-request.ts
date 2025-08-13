import { Command } from "commander";
import { out } from "@metriport/core/util/log";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";

import { writeSurescriptsRunsFile } from "./shared";
import { SurescriptsPatientRequestData } from "@metriport/core/external/surescripts/types";
import { executeAsynchronously } from "@metriport/core/util/concurrency";

/**
 * Sends a request to Surescripts for all patients of the facility. Uses the client's
 * batching method to send all patients in a single SFTP connection, which is what originally
 * created the need for this command (to upload large rosters quickly).
 *
 * Usage:
 * npm run surescripts -- facility-request \
 *  --cx-id <cx-id> \
 * --facility-id <facility-id> \
 * --csv-output <csv-output>
 *
 * cx-id: The CX ID of the requester
 * facility-id: The facility ID of the requester
 * csv-output: The file to write a CSV containing transmission IDs and patient IDs
 *
 * Note: The headers of the CSV file are "transmission_id","patient_id", which are used in scripts
 * like `convert-customer-responses` to convert the responses from Surescripts into FHIR resources.
 */
const program = new Command();

program
  .name("facility-request")
  .requiredOption("--cx-id <cx>", "The CX ID of the requester")
  .requiredOption("--facility-id <facility>", "The facility ID of the requester")
  .requiredOption("--csv-output <csvOutput>", "The file to write CSV IDs to")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      cxId,
      facilityId,
      csvOutput,
    }: {
      cxId: string;
      facilityId: string;
      csvOutput: string;
    }) => {
      const client = new SurescriptsSftpClient({
        logLevel: "info",
      });
      const dataMapper = new SurescriptsDataMapper();
      const { log } = out(`Surescripts sendFacilityRequest - cxId ${cxId}`);

      const patientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });
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
      log("Done writing facility requests");

      const csvContent =
        `"transmission_id","patient_id"\n` +
        identifiers
          .map(({ transmissionId, populationId }) => `"${transmissionId}","${populationId}"`)
          .join("\n");
      writeSurescriptsRunsFile(csvOutput + ".csv", csvContent);
    }
  );

export default program;
