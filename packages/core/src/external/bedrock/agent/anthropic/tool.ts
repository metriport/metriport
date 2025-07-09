import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AnthropicToolConfig } from "../../model/anthropic/tools";

export abstract class AnthropicTool<I = unknown, O = unknown> {
  private name: string;
  private description: string;
  private inputSchema: z.ZodSchema;
  private outputSchema: z.ZodSchema;

  constructor({
    name,
    description,
    inputSchema,
    outputSchema,
  }: Pick<AnthropicToolConfig, "name" | "description"> & {
    inputSchema: z.ZodSchema;
    outputSchema?: z.ZodSchema;
  }) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema ?? z.any();
  }

  async safelyExecute(input: I): Promise<O> {
    const validatedInput = this.inputSchema.parse(input);
    const result = await this.execute(validatedInput);
    const validatedResult = this.outputSchema.parse(result);
    return validatedResult;
  }

  abstract execute(input: I): Promise<O>;

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
