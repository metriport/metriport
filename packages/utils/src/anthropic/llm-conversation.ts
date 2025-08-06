import { AnthropicModel } from "@metriport/core/external/bedrock/model/anthropic";
import { AnthropicMessageThread } from "@metriport/core/external/bedrock/model/anthropic/messages";

/**
 * This is a simple example of using the Bedrock client to have a conversation with a model. You can
 * change the system prompt to provide specific instructions on how the model should respond.
 *
 * @see agent-with-tools.ts for an example of how to use tools with an Anthropic model.
 */

async function main() {
  const client = new AnthropicModel("claude-sonnet-3.7", "us-east-1");

  // You can customize the system prompt to provide directions to the model.
  const systemPrompt = `You are a helpful assistant.`;
  const messages: AnthropicMessageThread<"claude-sonnet-3.7"> = [];

  // Start a REPL until the user enters "bye".
  process.stdin.setEncoding("utf8");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const input = await promptUser();
    if (input.toLowerCase() === "bye") {
      process.stdout.write("Goodbye!\n");
      process.exit(0);
    }

    // Add the user message to the conversation history, then invoke the model with the full history.
    messages.push({ role: "user", content: [{ type: "text", text: input }] });
    const response = await client.invokeModel({
      system: systemPrompt,
      messages,
      max_tokens: 100,
    });

    // Add the assistant response as a message in the conversation history.
    messages.push({ role: "assistant", content: response.content });
    for (const content of response.content) {
      if (content.type === "text") {
        process.stdout.write(content.text);
      } else if (content.type === "tool_use") {
        process.stdout.write(`[TOOL CALL] [${content.name}]\n`);
        process.stdout.write(JSON.stringify(content.input, null, 2));
        process.stdout.write("\n");
      } else if (content.type === "thinking") {
        process.stdout.write(`[THINKING]  ${content.text}\n`);
      }
    }
    process.stdout.write("\n");
  }
}

/**
 * @returns The user input on stdin
 */
function promptUser(): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write("> ");
    process.stdin.on("data", data => {
      resolve(data.toString().trim());
    });
  });
}

main();
