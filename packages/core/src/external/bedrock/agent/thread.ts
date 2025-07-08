import { InvokeMessage, InvokeToolCall } from "../types";

export class BedrockAgentThread {
  private messages: InvokeMessage[];

  constructor(messages: InvokeMessage[] = []) {
    this.messages = messages;
  }

  addUserMessage(messageText: string): void {
    this.messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: messageText,
        },
      ],
    });
  }

  addToolCall(toolCall: InvokeToolCall): void {
    this.messages.push({
      role: "assistant",
      content: [toolCall],
    });
  }

  addToolResult(toolCall: InvokeToolCall, result?: unknown): void {
    this.messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolCall.id,
          ...(result ? { content: result } : {}),
        },
      ],
    });
  }

  addToolError(toolCall: InvokeToolCall, error: unknown): void {
    const errorMessage = error instanceof Error ? error.toString() : String(error);

    this.messages.push({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: toolCall.id, content: "Error: " + errorMessage },
      ],
    });
  }

  getMessages(): InvokeMessage[] {
    return this.messages;
  }
}
