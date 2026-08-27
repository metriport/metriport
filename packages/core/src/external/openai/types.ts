import { z } from "zod";
import type { OpenAI } from "openai";
import type { OpenAITool } from "./tool";

export enum OpenAIClientProvider {
  BEDROCK = "bedrock",
  BASETEN = "baseten",
}

export enum OpenAIModel {
  GPT_OSS_120B = "openai/gpt-oss-120b",
  GPT_OSS_20B = "openai/gpt-oss-20b",
  GLM_4_6_355B = "zai-org/GLM-4.6",
}

export interface OpenAIClientConfig {
  apiKey: string;
  baseURL: string;
  model: OpenAIModel;
  provider: OpenAIClientProvider;
}

export interface OpenAIAgentConfig extends Partial<OpenAIClientConfig> {
  provider?: OpenAIClientProvider;
  tools?: OpenAITool[];
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIToolConfig<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<I>;
  outputSchema?: z.ZodSchema<O>;
  strict?: boolean;
  handler: (input: I) => Promise<O>;
}

export type OpenAIRequest = Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  "model"
>;
export type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type OpenAIUserContent = OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"];
export type OpenAIResponse = OpenAI.Chat.Completions.ChatCompletion;

export type OpenAIAssistantMessage = OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
export type OpenAIAssistantContent = OpenAIAssistantMessage["content"];

export type OpenAIToolForRequest = OpenAI.Chat.Completions.ChatCompletionTool;
export type OpenAIToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
export type OpenAIToolResult = OpenAI.Chat.Completions.ChatCompletionToolMessageParam;

/** Represents the execution context of an OpenAI tool */
export interface OpenAIToolExecution {
  tool: OpenAITool;
  toolCall: OpenAIToolCall;
  arg: Record<string, unknown>;
}

export interface OpenAIUsage {
  inputTokens: number;
  outputTokens: number;
}
