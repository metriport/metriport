import { ClaudeAgent } from "../../bedrock/agent/claude";
import { ComprehendClient } from "../client";
import { SYSTEM_PROMPT } from "./prompt";

import { ExtractMedicationTool } from "./tool/extract-medication";

export class ComprehendAgent extends ClaudeAgent {
  constructor(comprehend: ComprehendClient) {
    super({
      version: "3.5",
      region: "us-east-1",
      systemPrompt: SYSTEM_PROMPT,
      tools: [new ExtractMedicationTool(comprehend)],
      maxTokens: 5000,
    });
  }
}
