#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsReceiveVerificationHandlerDirect } from "@metriport/core/external/surescripts/command/receive-verification/receive-verification-direct";

const program = new Command();

program
  .name("receive-verification")
  .option("--transmission-id <transmissionId>", "The transfer ID")
  .description("Checks for a verification response from Surescripts")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async ({ transmissionId }: { transmissionId?: string }) => {
    if (!transmissionId) throw new Error("Transmission ID is required");

    const handler = new SurescriptsReceiveVerificationHandlerDirect();
    await handler.receiveVerification({ transmissionId });
  });

export default program;
