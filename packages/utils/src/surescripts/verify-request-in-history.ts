#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsVerifyRequestInHistoryHandlerDirect } from "@metriport/core/external/surescripts/command/verify-request-in-history/verify-request-in-history-direct";

const program = new Command();

program
  .name("verify-request")
  .option("--transmission-id <transmissionId>", "The transfer ID")
  .description("Checks that the transmission is in the Surescripts history")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async ({ transmissionId }: { transmissionId?: string }) => {
    if (!transmissionId) throw new Error("Transmission ID is required");

    const handler = new SurescriptsVerifyRequestInHistoryHandlerDirect();
    const result = await handler.verifyRequestInHistory({ transmissionId });
    console.log(result);
  });

export default program;
