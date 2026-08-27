import { OpenAIToolForRequest, OpenAIToolConfig } from "./types";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Represents a tool that can be executed by an OpenAI model.
 * @param I - The type of the input to the tool.
 * @param O - The type of the output from the tool.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class OpenAITool<I = any, O = any> {
  private config: OpenAIToolConfig<I, O>;

  constructor(config: OpenAIToolConfig<I, O>) {
    this.config = config;
  }

  /**
   * Checks if the input provided by the LLM is valid for the tool.
   * @param input - The input to the tool.
   * @returns True if the input is valid, false otherwise.
   */
  canExecute(input: I): boolean {
    return this.config.inputSchema.safeParse(input).success;
  }

  async execute(input: I): Promise<O> {
    const validatedInput = this.config.inputSchema.parse(input);
    const result = await this.config.handler(validatedInput);

    if (this.config.outputSchema) {
      const validatedResult = this.config.outputSchema.parse(result);
      return validatedResult;
    }
    return result;
  }

  /**
   * Returns the name of the tool.
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Returns the tool configuration for the OpenAI API.
   */
  getRequestTool(): OpenAIToolForRequest {
    return {
      function: {
        name: this.config.name,
        description: this.config.description,
        parameters: zodToJsonSchema(this.config.inputSchema),
        strict: this.config.strict ?? true,
      },
      type: "function",
    };
  }
}
