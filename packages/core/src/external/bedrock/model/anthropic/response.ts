import { AnthropicModelVersion } from "./version";
import { AnthropicAssistantContent, AnthropicMessageText } from "./messages";
import { AnthropicUsage } from "./usage";

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
  usage: AnthropicUsage;
}

export function getAssistantResponseText<V extends AnthropicModelVersion>(
  response: AnthropicResponse<V>
): string | undefined {
  const textContent = response.content.filter(isTextContent);
  if (textContent.length === 0) {
    return undefined;
  }
  return concatenateAllTextContent(textContent);
}

function isTextContent<V extends AnthropicModelVersion>(
  content: AnthropicAssistantContent<V>[number]
): content is AnthropicMessageText {
  return content.type === "text";
}

function concatenateAllTextContent(content: AnthropicMessageText[]): string {
  const lines = content.map(content => content.text);
  return lines.join("\n");
}
