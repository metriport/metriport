#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsReceiveResponseHandlerDirect } from "@metriport/core/external/surescripts/command/receive-response/receive-response-direct";

const program = new Command();

program
  .name("receive-response")
  .argument("<transmissionId>", "The transmission ID")
  .argument("<populationOrPatientId>", "The population or patient ID")
  .description("Checks for a response from Surescripts")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async (transmissionId: string, populationOrPatientId: string) => {
    const handler = new SurescriptsReceiveResponseHandlerDirect();
    await handler.receiveResponse({ transmissionId, populationOrPatientId });
  });

export default program;
