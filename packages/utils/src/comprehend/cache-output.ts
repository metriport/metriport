import fs from "fs";
import path from "path";
import { Command } from "commander";
import { ComprehendClient } from "@metriport/core/external/comprehend/client";

const program = new Command();

program
  .name("cache")
  .description("Cache the output of the Comprehend client for a given text input")
  .argument("<text>", "The input text to submit to Comprehend")
  .option("--entities", "Cache the entities output")
  .option("--icd10cm", "Cache the ICD-10-CM output")
  .option("--rxnorm", "Cache the RxNorm output")
  .action(
    async (
      text,
      { entities, icd10cm, rxnorm }: { entities?: boolean; icd10cm?: boolean; rxnorm?: boolean }
    ) => {
      const comprehendClient = new ComprehendClient();
      const cacheKey = comprehendClient.getCacheKey(text);

      const cacheDir = path.join(process.cwd(), "runs/comprehend", cacheKey);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      const cacheInputPath = path.join(cacheDir, "input.txt");
      fs.writeFileSync(cacheInputPath, text, "utf8");
      console.log("Writing: " + cacheKey);

      if (entities) {
        const cacheOutputPath = path.join(cacheDir, "entities.json");
        if (fs.existsSync(cacheOutputPath)) {
          console.log("Already cached: " + cacheKey + "/entities.json");
          return;
        }
        const cacheOutput = await comprehendClient.detectEntities(text);
        fs.writeFileSync(cacheOutputPath, JSON.stringify(cacheOutput, null, 2), "utf8");
      }

      if (rxnorm) {
        const cacheRxNormPath = path.join(cacheDir, "rxnorm.json");
        if (fs.existsSync(cacheRxNormPath)) {
          console.log("Already cached: " + cacheKey + "/rxnorm.json");
          return;
        }
        const cacheRxNorm = await comprehendClient.inferRxNorm(text);
        fs.writeFileSync(cacheRxNormPath, JSON.stringify(cacheRxNorm, null, 2), "utf8");
      }

      if (icd10cm) {
        const cacheICD10CMPath = path.join(cacheDir, "icd10cm.json");
        if (fs.existsSync(cacheICD10CMPath)) {
          console.log("Already cached: " + cacheKey + "/icd10cm.json");
          return;
        }
        const cacheICD10CM = await comprehendClient.inferICD10CM(text);
        fs.writeFileSync(cacheICD10CMPath, JSON.stringify(cacheICD10CM, null, 2), "utf8");
        console.log("Writing: " + cacheKey);
      }
    }
  );

export default program;
