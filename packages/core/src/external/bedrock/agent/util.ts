import { InvokeResponse, InvokeToolCall } from "../types";

export function getToolCallOrFail(response: InvokeResponse): InvokeToolCall {
  const latestMessage = response.content[response.content.length - 1];
  if (!latestMessage) throw new Error("Unexpected empty response");

  if (latestMessage.type !== "tool_use") {
    throw new Error(`Expected tool call, but got ${latestMessage.type}`);
  }

  return latestMessage as InvokeToolCall;
}
