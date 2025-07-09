import { AnthropicModelVersion } from "./version";
import { AnthropicToolCall, AnthropicToolResult } from "./tools";

/**
 * A thread of messages between the user and the LLM.
 */
export type AnthropicMessageThread<V extends AnthropicModelVersion> = Array<
  AnthropicUserMessage | AnthropicAssistantMessage<V>
>;

/**
 * A user message to Anthropic can either be some text to the LLM, or the result from a tool call.
 */
export interface AnthropicUserMessage {
  role: "user";
  content: AnthropicUserContent;
}

export type AnthropicUserContent = Array<AnthropicMessageText | AnthropicToolResult>;

/**
 * An assistant response may contain multiple content blocks with text and possibly one or more tool calls.
 */
export interface AnthropicAssistantMessage<V extends AnthropicModelVersion> {
  role: "assistant";
  content: AnthropicAssistantContent<V>;
}

export type AnthropicAssistantContent<V extends AnthropicModelVersion> = Array<
  AnthropicMessageText | AnthropicToolCall | (V extends "3.5" ? never : AnthropicThinking)
>;

/**
 * A text message to/from the LLM.
 */
export interface AnthropicMessageText {
  type: "text";
  text: string;
}

export interface AnthropicThinking {
  type: "thinking";
  text: string;
  signature: string;
}
