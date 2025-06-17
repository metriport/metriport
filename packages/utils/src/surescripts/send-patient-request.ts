#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSendPatientRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-patient-request/send-patient-request-direct";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";

const program = new Command();

program
  .name("request")
  .option("-c, --cx-id <cx>", "The CX ID of the requester")
  .option("-f, --facility-id <facility>", "The facility ID of the requester")
  .option("-p, --patient-id <patient>", "Specific patient ID for the request")
  .description("Send a surescripts request for the given patient ID")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { cxId, facilityId, patientId } = program.opts();
    if (!cxId) throw new Error("CX ID is required");
    if (!facilityId) throw new Error("Facility ID is required");
    if (!patientId) throw new Error("Patient ID is required");

    const handler = new SurescriptsSendPatientRequestHandlerDirect(
      new SurescriptsSftpClient({
        logLevel: "debug",
      })
    );
    await handler.sendPatientRequest({ cxId, facilityId, patientId });
  });

export default program;
