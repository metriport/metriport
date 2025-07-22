import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { SurescriptsSendPatientRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-patient-request/send-patient-request-direct";

import { writeSurescriptsRunsFile } from "./shared";
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

      const transmissionRows: Array<[string, string]> = [["transmission_id", "patient_id"]];
      for (const patientId of patientIds) {
        console.log(`Sending request for patient ${patientId}`);
        const handler = new SurescriptsSendPatientRequestHandlerDirect(
          new SurescriptsSftpClient({
            logLevel: "debug",
          })
        );
        const transmissionId = await handler.sendPatientRequest({ cxId, facilityId, patientId });
        if (transmissionId) transmissionRows.push([transmissionId, patientId]);
      }

      const csvContent = transmissionRows.map(row => `"${row[0]}","${row[1]}"`).join("\n");
      writeSurescriptsRunsFile(csvOutput + ".csv", csvContent);
    }
  );

export default program;
