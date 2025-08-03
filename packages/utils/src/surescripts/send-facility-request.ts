import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";

import { writeSurescriptsRunsFile } from "./shared";
import { SurescriptsPatientRequestData } from "@metriport/core/external/surescripts/types";
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
      const dataMapper = new SurescriptsDataMapper();
      const patientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });
      console.log(`Found ${patientIds.length} patients`);

      const requests: SurescriptsPatientRequestData[] = [];
      for (const patientId of patientIds) {
        console.log(`Building request for patient ${patientId}`);
        const requestData = await dataMapper.getPatientRequestData({ cxId, facilityId, patientId });
        requests.push(requestData);
      }

      const client = new SurescriptsSftpClient({
        logLevel: "info",
      });
      console.log("Sending " + requests.length + " requests");
      const identifiers = await client.sendBatchPatientRequest(requests);
      console.log("Done writing facility requests");
      await client.disconnect();

      const csvContent =
        `"transmission_id","patient_id"\n` +
        identifiers
          .map(({ transmissionId, populationId }) => `"${transmissionId}","${populationId}"`)
          .join("\n");
      writeSurescriptsRunsFile(csvOutput + ".csv", csvContent);
    }
  );

export default program;
