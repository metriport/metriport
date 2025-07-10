import { z } from "zod";
import { getAnthropicModelId } from "../model/anthropic/version";
import { AnthropicAgent } from "../agent/anthropic";
import { AnthropicTool } from "../agent/anthropic/tool";
import { AnthropicResponse } from "../model/anthropic/response";
import { AnthropicToolCall } from "../model/anthropic/tools";
import { AnthropicMessageText, AnthropicMessageThread } from "../model/anthropic/messages";
import { AnthropicModel } from "../model/anthropic";
import zodToJsonSchema from "zod-to-json-schema";

describe("Anthropic test", () => {
  it("should get a correct model ID", () => {
    expect(getAnthropicModelId("claude-sonnet-3.5")).toBe(
      "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
    );
    expect(getAnthropicModelId("claude-sonnet-3.7")).toBe(
      "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
    );
    expect(getAnthropicModelId("claude-sonnet-4")).toBe(
      "us.anthropic.claude-sonnet-4-20250514-v1:0"
    );
  });

  it("should instantiate with a correct model ID", () => {
    expect(new AnthropicModel("claude-sonnet-3.5", "us-east-1")).toBeDefined();
    expect(new AnthropicModel("claude-sonnet-3.7", "us-east-1")).toBeDefined();
    expect(new AnthropicModel("claude-sonnet-4", "us-east-1")).toBeDefined();
  });

  it("should be able to invoke a model", async () => {
    const model = new AnthropicModel("claude-sonnet-3.7", "us-east-1");
    const response = await model.invokeModel({
      system: "You are an automated test. Reply with YES to confirm that you are working.",
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "Reply with YES to confirm that this works." }],
        },
      ],
    });
    expect(response.stop_reason).toBe("end_turn");
    const responseContent = response.content[0] as AnthropicMessageText;
    expect(responseContent.type).toBe("text");
    expect(responseContent.text.toLowerCase()).toContain("yes");
  });

  it("should be able to invoke a model with a tool", async () => {
    const model = new AnthropicModel("claude-sonnet-3.7", "us-east-1");
    const response = await model.invokeModel({
      system:
        "You are an automated test. Execute the completeTest tool with the input { working: 'YES'} to complete your task.",
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Execute the completeTest tool with the input { working: 'YES'} to complete your task.",
            },
          ],
        },
      ],
      tools: [
        {
          type: "custom",
          name: "completeTest",
          description: "Complete the test.",
          input_schema: zodToJsonSchema(z.object({ working: z.string() })),
        },
      ],
    });
    expect(response.stop_reason).toBe("tool_use");
    const toolCall = response.content[response.content.length - 1] as AnthropicToolCall;
    expect(toolCall.type).toBe("tool_use");
    expect(toolCall.name).toBe("completeTest");
    expect(toolCall.input).toEqual({ working: "YES" });
  });

  it("should validate tool calls", async () => {
    class GetCapitalTool extends AnthropicTool<{ country: string }, { capital: string }> {
      constructor() {
        super({
          name: "get_capital",
          description: "Get the capital of a given country.",
          inputSchema: z.object({ country: z.string() }),
          outputSchema: z.object({ capital: z.string() }),
        });
      }

      async execute(input: { country: string }): Promise<{ capital: string }> {
        if (input.country === "France") {
          return { capital: "Paris" };
        }
        throw new Error("Country not found");
      }
    }

    const agent = new AnthropicAgent({
      region: "us-east-1",
      version: "claude-sonnet-3.7",
      systemPrompt: "You are a helpful assistant.",
      tools: [new GetCapitalTool()],
    });

    const mockToolCall: AnthropicToolCall = {
      type: "tool_use",
      id: "1",
      name: "get_capital",
      input: {
        country: "France",
      },
    };

    const mockConversation: AnthropicMessageThread<"claude-sonnet-3.7"> = [
      {
        role: "user",
        content: [{ type: "text", text: "What is the capital of France?" }],
      },
      {
        role: "assistant",
        content: [mockToolCall],
      },
    ];

    agent.setConversation(mockConversation);

    const mockResponse: AnthropicResponse<"claude-sonnet-3.7"> = {
      id: "1",
      type: "message",
      model: "claude-sonnet-3.7",
      role: "assistant",
      content: [mockToolCall],
      stop_reason: "tool_use",
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    };

    expect(agent.shouldExecuteTools(mockResponse)).toBe(true);
    await agent.executeTools(mockResponse);
    expect(agent.getConversation()).toEqual([
      ...mockConversation,
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "1", content: { capital: "Paris" } }],
      },
    ]);
  });
});
