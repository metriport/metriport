import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { InvokeTool } from "./types";

export class BedrockTool {
  private name: string;
  private description: string;
  private inputSchema: z.ZodSchema;

  constructor(name: string, description: string, inputSchema: z.ZodSchema) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
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
