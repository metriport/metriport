#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsReceiveResponseHandlerDirect } from "@metriport/core/external/surescripts/command/receive-response/receive-response-direct";

const program = new Command();

program
  .name("receive-response")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--facility-id <facilityId>", "The facility ID")
  .option("--transmission-id <transmissionId>", "The transmission ID")
  .option("--population-id <populationId>", "The population ID")
  .description("Checks for a response from Surescripts")
  .showHelpAfterError()
  .version("1.0.0")
  .action(
    async ({
      cxId,
      facilityId,
      transmissionId,
      populationId,
    }: {
      cxId?: string;
      facilityId?: string;
      transmissionId?: string;
      populationId?: string;
    }) => {
      if (!cxId) throw new Error("Customer ID is required");
      if (!facilityId) throw new Error("Facility ID is required");
      if (!transmissionId) throw new Error("Transmission ID is required");
      if (!populationId) throw new Error("Population ID is required");

      const handler = new SurescriptsReceiveResponseHandlerDirect();
      await handler.receiveResponse({ cxId, facilityId, transmissionId, populationId });
    }
  );

export default program;
