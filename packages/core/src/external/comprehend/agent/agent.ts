import { BedrockAgent } from "../../bedrock/agent/agent";
import { AnthropicModel } from "../../bedrock/constants";
import { ComprehendClient } from "../client";
import { SYSTEM_PROMPT } from "./prompt";

import { ExtractMedicationTool } from "./tool/extract-medication";

export class ComprehendAgent extends BedrockAgent {
  constructor(comprehend: ComprehendClient) {
    super({
      region: "us-east-1",
      model: AnthropicModel.CLAUDE_3_5_SONNET,
      systemPrompt: SYSTEM_PROMPT,
      tools: [new ExtractMedicationTool(comprehend)],
      maxTokens: 5000,
    });
  }
}
