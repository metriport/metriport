import { AnthropicAgent } from "../agent/anthropic";
import { getAssistantResponseText } from "../model/anthropic/response";

describe("Anthropic agent test", () => {
  it("should be able to create an agent", async () => {
    const agent = new AnthropicAgent({
      version: "claude-sonnet-3.7",
      temperature: 0,
      maxTokens: 100,
      systemPrompt:
        "You are an automated test. Reply with YES if the user asks if you are working.",
      region: "us-east-1",
    });

    const response = await agent.startConversation("Are you working?");
    const firstMessage = getAssistantResponseText(response);
    expect(firstMessage?.toLowerCase()).toContain("yes");
  });
});
