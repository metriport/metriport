import { BedrockAgent } from "../../bedrock/agent/agent";
import { BedrockClient } from "../../bedrock/client";
import { ComprehendClient } from "../client";
import { SYSTEM_PROMPT } from "./prompt";

import { ExtractMedicationTool } from "./tool/extract-medication";

export class ComprehendAgent extends BedrockAgent {
  constructor(client: BedrockClient, comprehend: ComprehendClient) {
    super(client, {
      systemPrompt: SYSTEM_PROMPT,
      tools: [new ExtractMedicationTool(comprehend)],
      maxTokens: 5000,
    });
  }
}
