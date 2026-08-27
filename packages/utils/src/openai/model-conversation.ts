import { Command } from "commander";
import { buildOpenAIClient } from "@metriport/core/external/openai/client";
import { OpenAIClientProvider, OpenAIMessage } from "@metriport/core/external/openai/types";
import { promptUser, startInteractive, logResponse } from "./shared";

/**
 * This command allows you to have a conversation with an OpenAI model.
 * You can customize the system prompt to provide specific instructions
 * on how the model should respond.
 */
const command = new Command();
command.name("conversation");
command.description("Have a conversation with an OpenAI model.");
command.option(
  "--system-prompt <prompt>",
  "The system prompt to use",
  "You are a helpful assistant."
);
command.action(modelConversation);

const maxTokens = 10000;
const exitCommand = "bye";

/**
 * This is a simple example of using the OpenAI client to have a conversation with a model. You can
 * change the system prompt to provide specific instructions on how the model should respond.
 *
 * @see agent-with-tools.ts for an example of how to use tools with an OpenAI model.
 */

async function modelConversation({
  systemPrompt = "You are a helpful assistant.",
}: {
  systemPrompt?: string;
}): Promise<void> {
  const client = await buildOpenAIClient(OpenAIClientProvider.BASETEN);

  // You can customize the system prompt to provide directions to the model.
  const messages: OpenAIMessage[] = [{ role: "system", content: systemPrompt }];

  // Start a REPL until the user enters "bye".
  startInteractive();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const input = await promptUser();
    if (input.toLowerCase() === exitCommand) {
      process.exit(0);
    }

    // Add the user message to the conversation history, then invoke the model with the full history.
    messages.push({ role: "user", content: input });
    const response = await client.invokeModel({
      messages,
      max_tokens: maxTokens,
    });

    // Add the assistant response as a message in the conversation history.
    messages.push(...response.choices.map(choice => choice.message));
    logResponse(response);
  }
}

export default command;
