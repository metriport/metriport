import { AnthropicModelVersion } from "./version";
import { AnthropicMessageThread } from "./messages";
import { AnthropicToolConfig } from "./tools";

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
  messages: AnthropicMessageThread<V>;

  // Definitions of tools that the model may use.
  tools?: Array<AnthropicToolConfig>;

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
