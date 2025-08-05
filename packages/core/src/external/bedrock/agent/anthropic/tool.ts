import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AnthropicToolCall,
  AnthropicToolConfig,
  AnthropicToolResult,
  buildToolResultError,
} from "../../model/anthropic/tools";
import { AnthropicToolExecution } from "./types";

/**
 * Represents a tool that can be executed by an Anthropic agent.
 * @param I - The type of the input to the tool.
 * @param O - The type of the output from the tool.
 */
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
    this.outputSchema = outputSchema ?? z.unknown();
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
 * @param tools - The array of tools to map from.
 * @param toolCalls - The array of tool calls to map to.
 * @returns The array of tool executions.
 */
export function buildToolExecutions(
  tools: AnthropicTool[],
  toolCalls: AnthropicToolCall[]
): { toolExecutions: AnthropicToolExecution[]; toolErrors: AnthropicToolResult[] } {
  const toolExecutions: AnthropicToolExecution[] = [];
  const toolErrors: AnthropicToolResult[] = [];
  for (const toolCall of toolCalls) {
    const tool = tools.find(tool => tool.getName() === toolCall.name);
    // Invalid tool call ID is a very rare case
    if (!tool) {
      continue;
    } else if (tool.canExecute(toolCall.input)) {
      toolExecutions.push({ tool, toolCall, arg: toolCall.input });
    } else {
      toolErrors.push(
        buildToolResultError(toolCall, new Error(`Tool ${toolCall.name} input is invalid`))
      );
    }
  }
  return { toolExecutions, toolErrors };
}
