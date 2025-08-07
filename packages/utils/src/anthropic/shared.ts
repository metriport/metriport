import { AnthropicModelVersion } from "@metriport/core/external/bedrock/model/anthropic/version";
import { AnthropicResponse } from "@metriport/core/external/bedrock/model/anthropic/response";

export function startInteractive() {
  process.stdin.setEncoding("utf8");
}

export function stopInteractiveOnGoodbye(input: string) {
  if (input.toLowerCase() === "bye") {
    process.stdout.write("Goodbye!\n");
    process.exit(0);
  }
}

/**
 * @returns The user input on stdin
 */
export function promptUser(): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write("> ");
    process.stdin.on("data", data => {
      resolve(data.toString().trim());
    });
  });
}

export function logResponse<V extends AnthropicModelVersion>(response: AnthropicResponse<V>) {
  for (const content of response.content) {
    if (content.type === "text") {
      process.stdout.write(content.text);
      process.stdout.write("\n");
    } else if (content.type === "tool_use") {
      process.stdout.write(`[TOOL CALL] [${content.name}]\n`);
      process.stdout.write(JSON.stringify(content.input, null, 2));
      process.stdout.write("\n");
    }
  }
}
