import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { InvokeTool } from "../types";

export abstract class BedrockTool<T = unknown> {
  private name: string;
  private description: string;
  private inputSchema: z.ZodSchema;

  constructor(name: string, description: string, inputSchema: z.ZodSchema<T>) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
  }

  abstract execute(input: T): Promise<unknown>;

  getInvocation(): InvokeTool {
    return {
      type: "custom",
      name: this.name,
      description: this.description,
      input_schema: zodToJsonSchema(this.inputSchema),
    };
  }
}
