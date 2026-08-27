import { OpenAIResponse } from "@metriport/core/external/openai/types";

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
    function handleInput(data: string) {
      process.stdin.removeListener("data", handleInput);
      resolve(data.toString().trim());
    }
    process.stdin.on("data", handleInput);
    process.stdin.on("end", () => {
      process.stdin.removeListener("data", handleInput);
    });
  });
}

export function logResponse(response: OpenAIResponse) {
  for (const choice of response.choices) {
    process.stdout.write(choice.message.content ?? "");
    process.stdout.write("\n");
  }
}
