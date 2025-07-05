import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { InvokeTool } from "../types";
import { BedrockToolConfig } from "./types";

export abstract class BedrockTool<T = unknown> {
  private name: string;
  private description: string;
  private inputSchema: z.ZodSchema;

  constructor(config: BedrockToolConfig<T>) {
    this.name = config.name;
    this.description = config.description;
    this.inputSchema = config.inputSchema;
  }

  abstract execute(input: T): Promise<unknown>;

  getName() {
    return this.name;
  }

  getInvocation(): InvokeTool {
    return {
      type: "custom",
      name: this.name,
      description: this.description,
      input_schema: zodToJsonSchema(this.inputSchema),
    };
  }
}
