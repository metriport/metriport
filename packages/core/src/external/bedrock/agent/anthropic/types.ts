import { BedrockRegion } from "../../types";
import type { AnthropicTool } from "./tool";
import { AnthropicModelVersion } from "../../model/anthropic/version";

export interface AnthropicAgentConfig<V extends AnthropicModelVersion> {
  region: BedrockRegion;
  version: V;
  systemPrompt: string;
  tools?: AnthropicTool[];
  maxTokens?: number;
  temperature?: number;
}
