import { AnthropicModelVersion } from "./version";
import { AnthropicAssistantContent } from "./messages";

// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
export interface AnthropicResponse<V extends AnthropicModelVersion> {
  // Unique ID that starts with "msg_bdrk_..."
  id: string;
  type: "message";
  model: string;
  role: "assistant";

  // Messages, responses, and tool calls/results
  content: AnthropicAssistantContent<V>;
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}
