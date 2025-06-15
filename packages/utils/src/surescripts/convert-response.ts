#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";

import { Command } from "commander";
import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";

const program = new Command();

program
  .name("convert-response")
  .option("--transmission-id <transmissionId>", "The transmission ID")
  .option("--population-id <populationId>", "The population or patient ID")
  .description("Converts a patient or population response to FHIR bundles")
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

      const handler = new SurescriptsConvertBatchResponseHandlerDirect(new SurescriptsReplica());
      const bundles = await handler.convertBatchResponse({ transmissionId, populationId });

      for (const { patientId, bundle } of bundles) {
        fs.writeFileSync(
          path.join(process.cwd(), `runs/surescripts/1to1/${patientId}.json`),
          JSON.stringify(bundle, null, 2)
        );
      }
    }
  );

export default program;
