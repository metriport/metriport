export type AnthropicModelVersion = "claude-sonnet-3.5" | "claude-sonnet-3.7" | "claude-sonnet-4";

/**
 * An invocation request to a Bedrock LLM, serialized in the message body to InvokeModel.
 * https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
 */
export interface AnthropicRequest<V extends AnthropicModelVersion> {
  // Required anthropic version.
  anthropic_version?: "bedrock-2023-05-31";

  // A system prompt is a way of providing context and instructions to Anthropic Claude, such as specifying a particular goal or role.
  // https://docs.anthropic.com/en/docs/system-prompts
  system: string;

  // The maximum number of tokens to generate before stopping.
  max_tokens: number;

  // Array of conversation history with the model, including tool calls and results.
  messages: Array<AnthropicUserMessage | AnthropicAssistantMessage>;

  // Definitions of tools that the model may use.
  tools?: Array<AnthropicTool>;

  // Specifices how the model should use the provided tools. The model can use a specific tool, any available tool, or decide by itself.
  tool_choice?: {
    type: string;
    name: string;
  };

  // The temperature parameter to use for invocation.
  temperature?: number;

  // In nucleus sampling, Anthropic Claude computes the cumulative distribution over all the options for each subsequent token
  // in decreasing probability order and cuts it off once it reaches a particular probability specified by top_p. When adjusting
  // sampling parameters, modify either temperature or top_p. Do not modify both at the same time.
  top_p?: number;

  // Only sample from the top K options for each subsequent token.
  top_k?: number;

  // The sequences that will stop the model from generating more tokens.
  stop_sequences?: string[];

  // Introduced in Claude 3.7
  thinking?: V extends "3.5"
    ? never
    : {
        type: "enabled";
        budget_tokens: number;
      };
}

export interface AnthropicTool {
  type: "custom";
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicUserMessage {
  role: "user";
  content: Array<AnthropicMessageText | AnthropicToolResult>;
}

interface AnthropicMessageText {
  type: "text";
  text: string;
}

export interface AnthropicAssistantMessage {
  role: "assistant";
  content: Array<AnthropicMessageText | AnthropicToolCall>;
}

interface AnthropicToolCall {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicToolResult {
  type: "tool_result";
  tool_use_id: string;
  content?: unknown;
}

interface AnthropicThinking {
  type: "thinking";
  text: string;
  signature: string;
}

type AnthropicResponseContent<V extends AnthropicModelVersion> =
  | AnthropicMessageText
  | AnthropicToolCall
  | AnthropicToolResult
  | (V extends "3.5" ? never : AnthropicThinking);

// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
export interface AnthropicResponse<V extends AnthropicModelVersion> {
  // Unique ID that starts with "msg_bdrk_..."
  id: string;
  type: "message";
  model: string;
  role: "assistant";

  // Messages, responses, and tool calls/results
  content: AnthropicResponseContent<V>;
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}
