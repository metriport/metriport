import { z } from "zod";
import { AnthropicTool } from "../agent/anthropic/tool";

describe("Anthropic tool test", () => {
  it("should be able to create a tool", async () => {
    const tool = new AnthropicTool({
      name: "toUpperCase",
      description: "Convert a string to uppercase",
      inputSchema: z.object({
        name: z.string(),
      }),
      outputSchema: z.object({
        uppercased: z.string(),
      }),
      handler: async input => {
        return {
          uppercased: input.name.toUpperCase(),
        };
      },
    });

    expect(tool.getConfig()).toEqual({
      type: "custom",
      name: "toUpperCase",
      description: "Convert a string to uppercase",
      input_schema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        additionalProperties: false,
        type: "object",
        properties: {
          name: {
            type: "string",
          },
        },
        required: ["name"],
      },
    });

    const result = await tool.safelyExecute({ name: "hello" });
    expect(result.uppercased).toBe("HELLO");
  });
});
