import { AnthropicAgent } from "@metriport/core/external/bedrock/agent/anthropic";
import { logResponse, promptUser, startInteractive } from "./shared";

/**
 * Example of an Anthropic agent with tools, that searches within this monorepo to answer questions
 * about internal API endpoints and other util scripts.
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
    const input = await promptUser();
    if (input.toLowerCase() === "bye") {
      process.exit(0);
    }
    // Add the user message to the conversation history
    agent.addUserMessageText(input);
    const response = await agent.continueConversation();
    logResponse(response);
  }
}

main();
