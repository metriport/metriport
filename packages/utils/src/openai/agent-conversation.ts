import { Command } from "commander";
import { OpenAIAgent } from "@metriport/core/external/openai/agent";
import { logResponse, promptUser, startInteractive } from "./shared";

/**
 * This command allows you to run an OpenAI agent conversation. The agent will maintain the conversation history, so
 * you can continue the conversation by calling `continueConversation`.
 *
 * Usage:
 * npm run openai -- agent-conversation
 */
const command = new Command();
command.name("agent-conversation");
command.description("Example of an OpenAI agent conversation");
command.action(runAgentConversation);

const exitCommand = "bye";

/**
 * Example of an OpenAI agent conversation. The agent maintains the conversation history, so
 * you can continue the conversation by calling `continueConversation`.
 */

async function runAgentConversation() {
  const agent = new OpenAIAgent({
    systemPrompt: "You are a helpful assistant.",
    maxTokens: 1024,
    temperature: 0,
  });

  startInteractive();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Get user input, and
    const input = await promptUser();
    if (input.toLowerCase() === exitCommand) {
      process.exit(0);
    }

    agent.addUserMessage(input);
    const response = await agent.continueConversation();
    logResponse(response);
  }
}

export default command;
