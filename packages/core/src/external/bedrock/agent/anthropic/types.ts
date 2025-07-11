import { BedrockRegion } from "../../client";
import { AnthropicModelVersion } from "../../model/anthropic/version";
import { AnthropicToolCall } from "../../model/anthropic/tools";
import type { AnthropicTool } from "./tool";

export interface AnthropicAgentConfig<V extends AnthropicModelVersion> {
  region: BedrockRegion;
  version: V;
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: AnthropicTool<any, any>[];
  maxTokens?: number;
  temperature?: number;
}

export interface AnthropicToolExecution {
  tool: AnthropicTool;
  toolCall: AnthropicToolCall;
  arg: Record<string, unknown>;
}
