import { AnthropicAgent } from "@metriport/core/external/bedrock/agent/anthropic";
import { logResponse, promptUser, startInteractive } from "./shared";

/**
 * Example of an Anthropic agent conversation. The agent maintains the conversation history, so
 * you can continue the conversation by calling `continueConversation`.
 */

async function main() {
  const agent = new AnthropicAgent({
    version: "claude-sonnet-3.7",
    region: "us-east-1",
    systemPrompt: "You are a helpful assistant.",
    maxTokens: 1024,
    temperature: 0,
  });

  startInteractive();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Get user input, and
    const input = await promptUser();
    if (input.toLowerCase() === "bye") {
      process.exit(0);
    }

    agent.addUserMessageText(input);
    const response = await agent.continueConversation();
    logResponse(response);
  }
}

main();
