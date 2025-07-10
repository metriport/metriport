import { AnthropicModelVersion } from "./version";
import { AnthropicAssistantContent, AnthropicMessageText } from "./messages";

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

export function getAssistantResponseText<V extends AnthropicModelVersion>(
  response: AnthropicResponse<V>
): string | undefined {
  const textContent = response.content.filter(
    content => content.type === "text"
  ) as AnthropicMessageText[];
  if (textContent.length === 0) {
    return undefined;
  }
  return textContent.map(content => content.text).join("\n");
}
