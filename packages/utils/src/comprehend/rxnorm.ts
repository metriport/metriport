import { Command } from "commander";
import { ComprehendClient } from "@metriport/core/external/comprehend/client";

/**
 * Example usage of AWS Comprehend Medical to infer RxNorm codes from some medical text.
 */
const command = new Command();
command.name("rxnorm");
command.requiredOption("--text <text>", "The text to infer RxNorm codes from");
command.option(
  "--confidence-threshold <confidenceThreshold>",
  "The confidence threshold for selecting RxNorm codes",
  "0.5"
);
command.action(runRxNormInference);

async function runRxNormInference({
  text,
  confidenceThreshold,
}: {
  text: string;
  confidenceThreshold: number;
}) {
  console.log(text, confidenceThreshold);
  const comprehendClient = new ComprehendClient();
  const response = await comprehendClient.inferRxNorm(text);
  console.log(response);
}

export default command;
