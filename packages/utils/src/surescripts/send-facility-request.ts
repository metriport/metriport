import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";

import { writeSurescriptsRunsFile } from "./shared";
import { SurescriptsPatientRequestData } from "@metriport/core/external/surescripts/types";
const program = new Command();

program
  .name("facility-request")
  .option("--cx-id <cx>", "The CX ID of the requester")
  .option("--facility-id <facility>", "The facility ID of the requester")
  .option("--start <start>", "Patient ID to start from")
  .option("--csv-output <csvOutput>", "The file to write CSV IDs to")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      cxId,
      facilityId,
      csvOutput,
      start,
    }: {
      cxId: string;
      facilityId: string;
      csvOutput: string;
      start?: string;
    }) => {
      if (!cxId) throw new Error("CX ID is required");
      if (!facilityId) throw new Error("Facility ID is required");
      if (!csvOutput) throw new Error("CSV output file name required");

      const dataMapper = new SurescriptsDataMapper();
      let patientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });
      console.log(`Found ${patientIds.length} patients`);

      if (start) {
        const startIndex = patientIds.indexOf(start);
        if (startIndex < 0) throw new Error("Start ID not found in patient IDs");
        console.log("Starting after index " + startIndex);
        patientIds = patientIds.slice(startIndex + 1);
      }

      const requests: SurescriptsPatientRequestData[] = [];
      for (const patientId of patientIds) {
        console.log(`Building request for patient ${patientId}`);
        const requestData = await dataMapper.getPatientRequestData({ cxId, facilityId, patientId });
        requests.push(requestData);
      }

      const client = new SurescriptsSftpClient({
        logLevel: "debug",
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
