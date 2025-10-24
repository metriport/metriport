import { Command } from "commander";
import { ComprehendClient } from "@metriport/core/external/comprehend/client";

/**
 * Example usage of AWS Comprehend Medical to infer RxNorm codes from some medical text.
 */
const command = new Command();
command.name("rxnorm");
command.requiredOption("--text <text>", "The text to infer RxNorm codes from");
command.action(runRxNormInference);

async function runRxNormInference({ text }: { text: string }) {
  const comprehendClient = new ComprehendClient();
  const response = await comprehendClient.inferRxNorm(text);
  console.log(response);
}

export default command;
