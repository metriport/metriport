import { Command } from "commander";
import { ComprehendClient } from "@metriport/core/external/comprehend/client";

const program = new Command();

program
  .name("test-llm")
  .description("Tests the LLM-based approach with tool calling")
  .argument("<text>", "The input text to submit to Bedrock + Comprehend")
  .action(async text => {
    const comprehendClient = new ComprehendClient();
    const response = await comprehendClient.comprehendText(text);
    console.log("response", response);
  });

export default program;
