import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AnthropicToolCall, AnthropicToolConfig } from "../../model/anthropic/tools";
import { AnthropicToolExecution } from "./types";

export class AnthropicTool<I = unknown, O = unknown> {
  private name: string;
  private description: string;
  private inputSchema: z.ZodSchema;
  private outputSchema: z.ZodSchema;
  private handler: (input: I) => Promise<O>;

  constructor({
    name,
    description,
    inputSchema,
    outputSchema,
    handler,
  }: Pick<AnthropicToolConfig, "name" | "description"> & {
    inputSchema: z.ZodSchema<I>;
    outputSchema?: z.ZodSchema<O>;
    handler: (input: I) => Promise<O>;
  }) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema ?? z.any();
    this.handler = handler;
  }

  canExecute(input: I): boolean {
    return this.inputSchema.safeParse(input).success;
  }

  async execute(input: I): Promise<O> {
    const validatedInput = this.inputSchema.parse(input);
    const result = await this.handler(validatedInput);
    const validatedResult = this.outputSchema.parse(result);
    return validatedResult;
  }

  getName() {
    return this.name;
  }

  getConfig(): AnthropicToolConfig {
    return {
      type: "custom",
      name: this.name,
      description: this.description,
      input_schema: zodToJsonSchema(this.inputSchema),
    };
  }
}

/**
 * Maps an array of tool calls to an array of tool executions.
 * @param tools
 * @param toolCalls
 * @returns
 */
export function buildToolExecutions(
  tools: AnthropicTool[],
  toolCalls: AnthropicToolCall[]
): AnthropicToolExecution[] {
  const toolExecutions: AnthropicToolExecution[] = [];
  for (const toolCall of toolCalls) {
    const tool = tools.find(tool => tool.getName() === toolCall.name);
    if (tool && tool.canExecute(toolCall.input)) {
      toolExecutions.push({ tool, toolCall, arg: toolCall.input });
    }
  }
  return toolExecutions;
}
