import { InvokeResponse, InvokeToolCall, BedrockConfig } from "../types";
import type { BedrockTool } from "./tool";
import { z } from "zod";

export interface BedrockAgentConfig extends BedrockConfig {
  systemPrompt: string;
  tools?: BedrockTool[];
  maxTokens?: number;
  temperature?: number;
}

export interface BedrockToolConfig<T> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<T>;
}

export interface BedrockAgentResponse {
  response: InvokeResponse;
  toolCall?: InvokeToolCall;
  toolResult?: unknown;
  toolError?: unknown;
}
