import { z } from "zod";
import { AgentTool } from "../agent/tool";

describe("BedrockTool", () => {
  it("should be defined", () => {
    expect(AgentTool).toBeDefined();
  });

  it("should get a tool invocation", () => {
    type GetWeatherInput = { city: string };
    class GetWeatherTool extends AgentTool<GetWeatherInput> {
      constructor() {
        super({
          name: "get_weather",
          description: "Get the weather for a given city",
          inputSchema: z.object({ city: z.string() }),
        });
      }
      async execute(): Promise<{ temperature: number }> {
        return { temperature: 70 };
      }
    }

    const tool = new GetWeatherTool();

    expect(tool.getInvocation()).toEqual({
      type: "custom",
      name: "get_weather",
      description: "Get the weather for a given city",
      input_schema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        additionalProperties: false,
        type: "object",
        properties: {
          city: {
            type: "string",
          },
        },
        required: ["city"],
      },
    });
  });
});
