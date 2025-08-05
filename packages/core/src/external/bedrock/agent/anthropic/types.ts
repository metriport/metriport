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

/**
 * Represents the execution context of an Anthropic tool
 */
export interface AnthropicToolExecution {
  /** The tool instance being executed */
  tool: AnthropicTool;
  /** The tool call metadata from the model response */
  toolCall: AnthropicToolCall;
  /** The parsed input arguments for the tool */
  arg: Record<string, unknown>;
}
