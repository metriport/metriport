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
