import { AnthropicResponse } from "./response";
import { AnthropicModelVersion } from "./version";

/**
 * A tool definition given to Anthropic. Note that there are additional costs associated with
 * using tools, because a special prompt is automatically inserted into the system prompt. Do
 * not waste additional tokens telling the LLM that there are tools available - it knows!
 */
export interface AnthropicToolConfig {
  type: "custom";
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
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

export function getToolCallsFromResponse<V extends AnthropicModelVersion>(
  response: AnthropicResponse<V>
): AnthropicToolCall[] {
  return response.content.filter(({ type }) => type === "tool_use") as AnthropicToolCall[];
}

export function buildToolResult(
  toolCall: AnthropicToolCall,
  content: unknown
): AnthropicToolResult {
  return {
    type: "tool_result",
    tool_use_id: toolCall.id,
    content,
  };
}

export function buildToolResultError(
  toolCall: AnthropicToolCall,
  error: unknown
): AnthropicToolResult {
  return {
    type: "tool_result",
    tool_use_id: toolCall.id,
    content: {
      error: error instanceof Error ? error.message : String(error),
    },
  };
}
