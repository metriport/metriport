import type { AnthropicModelVersion } from "../../bedrock/model/anthropic/version";
import type { ComprehendContext } from "../types";
import type { SpecializedAgent } from "./specialized-agent";

export const COMPREHEND_AGENT_VERSION: AnthropicModelVersion = "claude-sonnet-3.7" as const;

export type SpecializedAgentClass = {
  new (context: ComprehendContext): SpecializedAgent;
};

export interface SpecializedAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
}
