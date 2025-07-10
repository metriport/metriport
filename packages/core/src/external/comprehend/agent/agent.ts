import { AnthropicAgent } from "../../bedrock/agent/anthropic";
import { ComprehendClient } from "../client";
import { SYSTEM_PROMPT } from "./prompt";

import { ExtractMedicationTool } from "./tool/extract-medication";
import { ExtractProcedureTool } from "./tool/extract-procedure";
import { ExtractConditionTool } from "./tool/extract-condition";

export class ComprehendAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  constructor(comprehend: ComprehendClient) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: SYSTEM_PROMPT,
      tools: [
        new ExtractMedicationTool(comprehend),
        new ExtractProcedureTool(comprehend),
        new ExtractConditionTool(comprehend),
      ],
      maxTokens: 5000,
    });
  }
}
