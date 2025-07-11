import { z } from "zod";
// import { BadRequestError } from "@metriport/shared";
import { AnthropicAgent } from "../agent/anthropic";
import { AnthropicTool } from "../agent/anthropic/tool";
import { AnthropicMessageThread } from "../model/anthropic/messages";
import { getAssistantResponseText } from "../model/anthropic/response";
import { AnthropicToolCall, AnthropicToolResult } from "../model/anthropic/tools";

describe("Anthropic agent test", () => {
  it("should be able to create an agent", async () => {
    const agent = new AnthropicAgent({
      version: "claude-sonnet-3.7",
      systemPrompt:
        "You are an automated test. Reply with YES if the user asks if you are working.",
      region: "us-east-1",
    });

    const response = await agent.startConversation("Are you working?");
    const firstMessage = getAssistantResponseText(response);
    expect(firstMessage?.toLowerCase()).toContain("yes");
  });

  it("should be able to maintain a simple conversation", async () => {
    const agent = new AnthropicAgent({
      version: "claude-sonnet-3.7",
      systemPrompt:
        "You are an automated test. Any time you are asked if you are working, reply with YES.",
      region: "us-east-1",
    });

    const response = await agent.startConversation("Are you working?");
    const firstMessage = getAssistantResponseText(response);
    expect(firstMessage?.toLowerCase()).toContain("yes");
    expect(agent.shouldExecuteTools(response)).toBe(false);
    expect(() => agent.executeTools(response)).toThrow();

    agent.addUserMessage("Are you sure you are working?");
    const nextResponse = await agent.continueConversation();
    const nextMessage = getAssistantResponseText(nextResponse);
    expect(nextMessage?.toLowerCase()).toContain("yes");
  });

  it("should be able to execute a tool", async () => {
    const agent = new AnthropicAgent({
      version: "claude-sonnet-3.7",
      systemPrompt:
        'Parse the sentence provided by the user into the input for the "parseSentence" tool.',
      region: "us-east-1",
      tools: [
        new AnthropicTool({
          name: "parseSentence",
          description: "Parse the user's message",
          inputSchema: z.object({ color: z.string(), animal: z.string() }),
          outputSchema: z.object({ result: z.string() }),
          handler: async input => {
            return {
              result: `Praise the ${input.color} ${input.animal}`,
            };
          },
        }),
      ],
    });

    const color = randomChoice(["red", "blue", "green"]);
    const animal = randomChoice(["dog", "cat", "bird"]);
    const response = await agent.startConversation(
      `The ${color} ${animal} likes to write automated tests.`
    );
    expect(agent.shouldExecuteTools(response)).toBe(true);

    await agent.executeTools(response);
    const conversation = await agent.getConversation();
    const lastMessage = conversation[conversation.length - 1];
    expect(lastMessage).toBeDefined();
    expect(lastMessage?.role).toBe("user");
    const toolResult = lastMessage?.content[0] as AnthropicToolResult;
    expect(toolResult.type).toBe("tool_result");
    expect(toolResult.content).toEqual({ result: `Praise the ${color} ${animal}` });
  });

  it("should handle multiple tool calls with an error", async () => {
    const agent = new AnthropicAgent({
      version: "claude-sonnet-3.7",
      systemPrompt: "You are an automated test that is not executed with the LLM.",
      region: "us-east-1",
      tools: [
        new AnthropicTool({
          name: "errorProducingTool",
          description: "An error producing tool",
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ result: z.string() }),
          handler: async () => {
            throw new Error("The error message");
          },
        }),
      ],
    });

    const mockToolUseId = "bedrock_tool_1";
    const mockToolUse: AnthropicToolCall = {
      type: "tool_use",
      name: "errorProducingTool",
      id: mockToolUseId,
      input: {
        input: "The input",
      },
    };
    const mockResponse: Awaited<ReturnType<typeof agent.continueConversation>> = {
      id: "msg_bdrk_123",
      type: "message",
      model: "claude-sonnet-3.7",
      role: "assistant",
      content: [mockToolUse],
      stop_reason: "tool_use",
      usage: {
        input_tokens: 100,
        output_tokens: 100,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    };

    const mockConversation: AnthropicMessageThread<"claude-sonnet-3.7"> = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "An example message that called an error producing tool",
          },
        ],
      },
      {
        role: "assistant",
        content: [mockToolUse],
      },
    ];

    agent.setConversation(mockConversation);
    expect(agent.shouldExecuteTools(mockResponse)).toBe(true);
    await agent.executeTools(mockResponse);

    const conversation = agent.getConversation();
    expect(conversation).toEqual([
      ...mockConversation,
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: mockToolUseId,
            content: {
              error: "The error message",
            },
          },
        ],
      },
    ]);
  });
});

function randomChoice<T>(choices: T[]): T {
  const choice = choices[Math.floor(Math.random() * choices.length)];
  if (!choice) {
    throw new Error("Must be at least one choice");
  }
  return choice;
}
