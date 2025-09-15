import { Command } from "commander";
import {
  InferenceApi,
  buildRxNormArtifact,
  buildConditionArtifact,
  buildSnomedCTArtifact,
} from "./shared";

/**
 * Build a test artifact for the Comprehend API for the RxNorm inference API.
 */
const command = new Command();
command.name("build-test");
command.description("Build a test artifact for the the Comprehend Medical inference API");
command.requiredOption("--api <api>", "The API to build a test artifact for", [
  "rxnorm",
  "icd10cm",
  "snomedct",
]);
command.requiredOption("--name <name>", "The name of the test artifact");
command.argument("<input-text>", "The input text for the test artifact");

command.action(async (inputText: string, { name, api }: { name: string; api: InferenceApi }) => {
  switch (api) {
    case "rxnorm":
      await buildRxNormArtifact({ name, inputText });
      break;
    case "icd10cm":
      await buildConditionArtifact({ name, inputText });
      break;
    case "snomedct":
      await buildSnomedCTArtifact({ name, inputText });
      break;
  }
});

export default command;
