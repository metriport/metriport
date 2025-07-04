import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BedrockClient } from "./client";
import { AnthropicModel } from "./constants";
import { InvokeRequest, InvokeResponse, InvokeToolCall } from "./types";

async function main() {
  const client = new BedrockClient(AnthropicModel.CLAUDE_3_5_SONNET, "us-east-2");
  let response: InvokeResponse | undefined = undefined;
  const messages: InvokeRequest["messages"] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Insert medical text here",
        },
      ],
    },
  ];

  let iterations = 0;
  do {
    response = await client.invokeModel({
      max_tokens: 1000,
      temperature: 0,
      system:
        "Your role is to choose an extraction tool from the provided tools, and call them with substrings of medical text provided by the user. " +
        "The extraction tools are specialized in tagging the text with medical codes. " +
        "You should pass this text without modification to the appropriate tool for detailed extraction. " +
        "Do not produce any output or tell me what you are doing. " +
        "I will not run the tool if the substring is not found in the original text. " +
        "Do not pass the same text to multiple tools, pick the most relevant tool. " +
        "Try to pass the most concise possible substring of text to the extraction tools, but don't leave out any important details.",
      messages: messages,
      tools: [
        {
          type: "custom",
          name: "extractMedication",
          description: "Extract medication information from the provided medical text.",
          input_schema: zodToJsonSchema(
            z.object({
              text: z.string(),
            })
          ),
        },
        {
          type: "custom",
          name: "extractConditions",
          description: "Extract conditions from the provided medical text with ICD 10 codes.",
          input_schema: zodToJsonSchema(
            z.object({
              text: z.string(),
            })
          ),
        },
        {
          type: "custom",
          name: "extractProcedures",
          description: "Extract procedures from the provided medical text with ICD 10 codes.",
          input_schema: zodToJsonSchema(
            z.object({
              text: z.string(),
            })
          ),
        },
      ],
    });

    console.log(JSON.stringify(response, null, 2));
    if (response.stop_reason === "tool_use") {
      const toolCall = response.content[response.content.length - 1] as InvokeToolCall<{
        text: string;
      }>;
      messages.push({
        role: "assistant",
        content: [toolCall],
      });

      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: "Finished extraction",
          },
        ],
      });
      console.log(messages);
    }
    iterations++;
  } while (response != null && response.stop_reason === "tool_use" && iterations < 5);
}

main();
