#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSendPatientRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-patient-request/send-patient-request-direct";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";

const program = new Command();

program
  .name("request")
  .requiredOption("-c, --cx-id <cx>", "The CX ID of the requester")
  .requiredOption("-f, --facility-id <facility>", "The facility ID of the requester")
  .requiredOption("-p, --patient-id <patient>", "Specific patient ID for the request")
  .description("Send a surescripts request for the given patient ID")
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      cxId,
      facilityId,
      patientId,
    }: {
      cxId: string;
      facilityId: string;
      patientId: string;
    }) => {
      const handler = new SurescriptsSendPatientRequestHandlerDirect(
        new SurescriptsSftpClient({
          logLevel: "debug",
        })
      );
      await handler.sendPatientRequest({ cxId, facilityId, patientId });
    }
  );

export default program;
