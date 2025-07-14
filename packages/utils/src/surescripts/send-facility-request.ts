import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { SurescriptsSendPatientRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-patient-request/send-patient-request-direct";

const program = new Command();

program
  .name("facility-request")
  .option("--cx-id <cx>", "The CX ID of the requester")
  .option("--facility-id <facility>", "The facility ID of the requester")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { cxId, facilityId } = program.opts();

    if (!cxId) throw new Error("CX ID is required");
    if (!facilityId) throw new Error("Facility ID is required");

    const handler = new SurescriptsSendPatientRequestHandlerDirect(
      new SurescriptsSftpClient({
        logLevel: "debug",
      })
    );
    const dataMapper = new SurescriptsDataMapper();
    const patientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });
    console.log(`Found ${patientIds.length} patients`);

    for (const patientId of patientIds) {
      console.log(`Sending request for patient ${patientId}`);
      await handler.sendPatientRequest({ cxId, facilityId, patientId });
    }
  });

export default program;
