import { BedrockAgentThread } from "../agent/thread";
import { InvokeToolCall } from "../types";

describe("BedrockAgentThread", () => {
  it("should add a user message", () => {
    const thread = new BedrockAgentThread();
    thread.addUserMessage("Hello, world!");

    expect(thread.getMessages()).toEqual([
      {
        role: "user",
        content: [{ type: "text", text: "Hello, world!" }],
      },
    ]);
  });

  it("should add a tool call", () => {
    const thread = new BedrockAgentThread();
    thread.addToolCall({
      id: "1",
      type: "tool_use",
      name: "get_weather",
      input: { city: "New York" },
    });

    expect(thread.getMessages()).toEqual([
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "1", name: "get_weather", input: { city: "New York" } }],
      },
    ]);
  });

  it("should add a tool result", () => {
    const thread = new BedrockAgentThread();
    const toolUse: InvokeToolCall = {
      id: "1",
      type: "tool_use",
      name: "get_weather",
      input: { city: "New York" },
    };
    thread.addToolCall(toolUse);
    thread.addToolResult(toolUse, { temperature: 70 });

    expect(thread.getMessages()).toEqual([
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "1", name: "get_weather", input: { city: "New York" } }],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "1", content: { temperature: 70 } }],
      },
    ]);
  });
});
