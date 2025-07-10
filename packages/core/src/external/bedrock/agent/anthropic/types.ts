import { BedrockRegion } from "../../client";
import type { AnthropicTool } from "./tool";
import { AnthropicModelVersion } from "../../model/anthropic/version";

export interface AnthropicAgentConfig<V extends AnthropicModelVersion> {
  region: BedrockRegion;
  version: V;
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: AnthropicTool<any, any>[];
  maxTokens?: number;
  temperature?: number;
}
