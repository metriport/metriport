import { InvokeMessage, InvokeToolCall } from "./types";

export class BedrockThread {
  private messages: InvokeMessage[];

  constructor(messages: InvokeMessage[] = []) {
    this.messages = messages;
  }

  addUserMessage(messageText: string) {
    this.messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: messageText,
        },
      ],
    });
    return this;
  }

  addToolCall(toolCall: InvokeToolCall) {
    this.messages.push({
      role: "assistant",
      content: [toolCall],
    });
    return this;
  }

  addToolResult(toolCall: InvokeToolCall, result?: unknown) {
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
    return this;
  }

  getMessages() {
    return this.messages;
  }
}
