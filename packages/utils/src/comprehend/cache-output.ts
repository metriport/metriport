import fs from "fs";
import path from "path";
import { Command } from "commander";
import { ComprehendClient } from "@metriport/core/external/comprehend/client";

const program = new Command();

program
  .name("cache")
  .description("Cache the output of the Comprehend client for a given text input")
  .argument("<text>", "The input text to submit to Comprehend")
  .action(async text => {
    const comprehendClient = new ComprehendClient();
    const cacheKey = comprehendClient.getCacheKey(text);

    const cacheDir = path.join(process.cwd(), "runs/comprehend", cacheKey);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    } else {
      console.log("Cache already exists");
      return;
    }
    const cacheInputPath = path.join(cacheDir, "input.txt");
    fs.writeFileSync(cacheInputPath, text, "utf8");

    const cacheOutputPath = path.join(cacheDir, "entities.json");
    const cacheOutput = await comprehendClient.detectEntities(text);
    fs.writeFileSync(cacheOutputPath, JSON.stringify(cacheOutput, null, 2), "utf8");

    const cacheRxNormPath = path.join(cacheDir, "rxnorm.json");
    const cacheRxNorm = await comprehendClient.inferRxNorm(text);
    fs.writeFileSync(cacheRxNormPath, JSON.stringify(cacheRxNorm, null, 2), "utf8");

    const cacheICD10CMPath = path.join(cacheDir, "icd10cm.json");
    const cacheICD10CM = await comprehendClient.inferICD10CM(text);
    fs.writeFileSync(cacheICD10CMPath, JSON.stringify(cacheICD10CM, null, 2), "utf8");
  });

export default program;
