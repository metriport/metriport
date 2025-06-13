#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsReceiveResponseHandlerDirect } from "@metriport/core/external/surescripts/command/receive-response/receive-response-direct";

const program = new Command();

program
  .name("receive-response")
  .option("--transmission-id <transmissionId>", "The transmission ID")
  .option("--population-id <populationId>", "The population ID")
  .description("Checks for a response from Surescripts")
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      transmissionId,
      populationId,
    }: {
      transmissionId?: string;
      populationId?: string;
    }) => {
      if (!transmissionId) throw new Error("Transmission ID is required");
      if (!populationId) throw new Error("Population ID is required");

      const handler = new SurescriptsReceiveResponseHandlerDirect();
      await handler.receiveResponse({ transmissionId, populationId });
    }
  );

export default program;
