import { AnthropicModel } from "./constants";

export type BedrockRegion = "us-east-1" | "us-east-2" | "us-west-2";

export interface BedrockConfig {
  region: BedrockRegion;
  model: AnthropicModel;
}

/**
 * An invocation request to a Bedrock LLM, serialized in the message body to InvokeModel.
 */
export interface InvokeRequest {
  /**
   * A system prompt is a way of providing context and instructions to Anthropic Claude, such as specifying a
   * particular goal or role.
   * > https://docs.anthropic.com/en/docs/system-prompts
   */
  system: string;

  /**
   * The maximum number of tokens to generate before stopping.
   */
  max_tokens: number;

  /**
   * Array of conversation history with the model, including tool calls and results.
   */
  messages: Array<InvokeMessage>;

  /**
   * Definitions of tools that the model may use.
   */
  tools?: InvokeTool[];

  /**
   * Specifices how the model should use the provided tools. The model can use a specific tool, any available tool, or decide by itself.
   */
  tool_choice?: {
    type: string;
    name: string;
  };

  /**
   * The temperature parameter to use for invocation.
   */
  temperature?: number;

  /**
   * In nucleus sampling, Anthropic Claude computes the cumulative distribution over all the options for each subsequent token
   * in decreasing probability order and cuts it off once it reaches a particular probability specified by top_p. When adjusting
   * sampling parameters, modify either temperature or top_p. Do not modify both at the same time.
   */
  top_p?: number;

  /**
   * Only sample from the top K options for each subsequent token.
   */
  top_k?: number;

  /**
   * The sequences that will stop the model from generating more tokens.
   */
  stop_sequences?: string[];
}

export interface InvokeResponse {
  /**
   * Unique ID that starts with "msg_bdrk_..."
   */
  id: string;
  type: "message";
  model: string;
  role: "assistant";
  content: Array<InvokeResponseMessage | InvokeToolCall>;
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export interface InvokeMessage {
  role: "user" | "assistant";
  content: Array<InvokeMessageText | InvokeToolCall | InvokeToolResult>;
}

export interface InvokeResponseMessage {
  type: "message";
}

export interface InvokeToolCall<T = unknown> {
  type: "tool_use";
  id: string;
  name: string;
  input: T;
}

export interface InvokeToolResult {
  type: "tool_result";
  tool_use_id: string;
  content?: unknown;
}

export interface InvokeMessageText {
  type: "text";
  text: string;
}

export interface InvokeTool {
  type: "custom";
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface BedrockToolConfig {
  type: "custom";
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
