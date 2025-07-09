import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { InvokeTool } from "../types";
import { BedrockToolConfig } from "./types";

export abstract class AgentTool<I = unknown, O = unknown> {
  private name: string;
  private description: string;
  private inputSchema: z.ZodSchema;

  constructor(config: BedrockToolConfig<I>) {
    this.name = config.name;
    this.description = config.description;
    this.inputSchema = config.inputSchema;
  }

  abstract execute(input: I): Promise<O>;

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
