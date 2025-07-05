import type { BedrockTool } from "./tool";

export interface BedrockAgentConfig {
  systemPrompt: string;
  tools?: BedrockTool[];
  maxTokens?: number;
  temperature?: number;
}
