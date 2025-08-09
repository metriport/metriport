import { Command } from "commander";
import { out } from "@metriport/core/util/log";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";

import { writeSurescriptsIdentifiersFile } from "./shared";
import { SurescriptsPatientRequestData } from "@metriport/core/external/surescripts/types";
import { executeAsynchronously } from "@metriport/core/util/concurrency";

/**
 * This script is used to send a request to Surescripts to retrieve all patients for a particular customer and facility.
 * It must be run from within the corresponding VPC (staging or production), otherwise you will generate a valid request
 * file but it will not be received by Surescripts since only a very specific IP set is whitelisted for requests. See 1PW.
 *
 * Usage:
 * npm run surescripts -- facility-request --cx-id <cx-id> --facility-id <facility-id> --csv-output <csv-output>
 *
 * The CSV output file will contain the transmission IDs and patient IDs for the requests that were sent. This output
 * file is required for running the corresponding script to retrieve the responses from Surescripts, which can vary in
 * duration based on their processing periods.
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
      writeSurescriptsIdentifiersFile(csvOutput, identifiers);
      log(`Wrote ${identifiers.length} identifiers to ${csvOutput}.csv`);
    }
  );

export default program;
