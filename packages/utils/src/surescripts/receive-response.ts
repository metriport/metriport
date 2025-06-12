#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsReceiveResponseHandlerDirect } from "@metriport/core/external/surescripts/command/receive-response/receive-response-direct";

const program = new Command();

program
  .name("receive-response")
  .argument("<transmissionId>", "The transfer ID")
  .description("Checks for a response from Surescripts")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async (transmissionId: string) => {
    const handler = new SurescriptsReceiveResponseHandlerDirect();
    await handler.receiveResponse({ transmissionId });
  });

export default program;
