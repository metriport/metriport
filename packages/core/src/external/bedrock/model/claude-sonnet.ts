import { BedrockModel } from "../model";
import {
  InvokeMessage,
  InvokeTool,
  InvokeToolCall,
  InvokeResponseMessage,
  BedrockRegion,
  InvokeToolResult,
} from "../types";

export type ClaudeSonnetVersion = "3.5" | "3.7";
export const ClaudeSonnetModelId: Record<ClaudeSonnetVersion, string> = {
  "3.5": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  "3.7": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
};

export class ClaudeSonnet extends BedrockModel<ClaudeSonnetRequest, ClaudeSonnetResponse> {
  version: ClaudeSonnetVersion;

  constructor(version: ClaudeSonnetVersion, region: BedrockRegion) {
    super(ClaudeSonnetModelId[version], region);
    this.version = version;
  }

  override async invoke(input: ClaudeSonnetRequest): Promise<ClaudeSonnetResponse> {
    return super.invoke({
      anthropic_version: "bedrock-2023-05-31",
      ...input,
    });
  }
}

/**
 * An invocation request to a Bedrock LLM, serialized in the message body to InvokeModel.
 * https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
 */
export interface ClaudeSonnetRequest {
  /**
   * Required anthropic version.
   */
  anthropic_version?: "bedrock-2023-05-31";

  /**
   * A system prompt is a way of providing context and instructions to Anthropic Claude, such as specifying a
   * particular goal or role.
   * https://docs.anthropic.com/en/docs/system-prompts
   */
  system: string;

  /**
   * The maximum number of tokens to generate before stopping.
   */
  max_tokens: number;

  /**
   * Array of conversation history with the model, including tool calls and results.
   */
  messages: InvokeMessage[];

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

/**
 * https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
 */
export interface ClaudeSonnetResponse {
  /**
   * Unique ID that starts with "msg_bdrk_..."
   */
  id: string;
  type: "message";
  model: string;
  role: "assistant";
  /**
   * Messages, responses, and tool calls/results.
   */
  content: (InvokeResponseMessage | InvokeToolCall | InvokeToolResult)[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}
