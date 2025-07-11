import { AnthropicAgent } from "../../bedrock/agent/anthropic";
import { ComprehendClient } from "../client";
import { SYSTEM_PROMPT } from "./prompt";

import { buildComprehendMedicationTool } from "./tool/medication";
import { buildComprehendProcedureTool } from "./tool/procedure";
import { buildComprehendConditionTool } from "./tool/condition";

export class ComprehendAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  constructor(comprehend: ComprehendClient = new ComprehendClient()) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: SYSTEM_PROMPT,
      tools: [
        buildComprehendMedicationTool(comprehend),
        buildComprehendProcedureTool(comprehend),
        buildComprehendConditionTool(comprehend),
      ],
      maxTokens: 10000,
    });
  }

  async extractResources(text: string) {
    let response = await this.startConversation(text);
    if (!this.shouldExecuteTools(response)) return [];

    do {
      await this.executeTools(response);
      response = await this.continueConversation();
    } while (this.shouldExecuteTools(response));

    return response.content;
  }
}
