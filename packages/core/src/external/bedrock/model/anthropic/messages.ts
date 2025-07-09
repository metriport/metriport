import { AnthropicModelVersion } from "./version";

/**
 * A thread of messages between the user and the LLM.
 */
export type AnthropicMessageThread<V extends AnthropicModelVersion> = Array<
  AnthropicUserMessage | AnthropicAssistantMessage<V>
>;

export type AnthropicUserContent = Array<AnthropicMessageText | AnthropicToolResult>;

export type AnthropicAssistantContent<V extends AnthropicModelVersion> = Array<
  AnthropicMessageText | AnthropicToolCall | (V extends "3.5" ? never : AnthropicThinking)
>;

/**
 * A user message to Anthropic can either be some text to the LLM, or the result from a tool call.
 */
export interface AnthropicUserMessage {
  role: "user";
  content: AnthropicUserContent;
}

/**
 * A text message to/from the LLM.
 */
export interface AnthropicMessageText {
  type: "text";
  text: string;
}

/**
 * A message can also be an assistant response, which may contain multiple content blocks of text and may
 * include one or more tool calls.
 */
export interface AnthropicAssistantMessage<V extends AnthropicModelVersion> {
  role: "assistant";
  content: AnthropicAssistantContent<V>;
}

/**
 * Returned by the LLM as a request to invoke a tool.
 */
export interface AnthropicToolCall {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Provided to the LLM in a user
 */
export interface AnthropicToolResult {
  type: "tool_result";
  tool_use_id: string;
  content?: unknown;
}

export interface AnthropicThinking {
  type: "thinking";
  text: string;
  signature: string;
}
