import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AnthropicModel } from "./model/anthropic";
import { AnthropicMessageThread } from "./model/anthropic/messages";
import { AnthropicToolCall } from "./model/anthropic/tools";

async function main() {
  const claude = new AnthropicModel("claude-sonnet-3.7", "us-west-2");

  const thread: AnthropicMessageThread<"claude-sonnet-3.7"> = [
    {
      role: "user",
      content: [{ type: "text", text: "Hello, how are you?" }],
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "I'm doing great, thank you for asking!",
        },
      ],
    },
    {
      role: "user",
      content: [{ type: "text", text: "What is the capital of France?" }],
    },
  ];

  const response = await claude.invokeModel({
    max_tokens: 1000,
    temperature: 0,
    system: "You are a helpful assistant.",
    messages: thread,
    tools: [
      {
        type: "custom",
        name: "get_capital",
        description: "Get the capital of a given country.",
        input_schema: zodToJsonSchema(
          z.object({
            country: z.string(),
          })
        ),
      },
    ],
  });

  thread.push({
    role: "assistant",
    content: response.content,
  });

  if (response.stop_reason === "tool_use") {
    const toolCall = response.content.find(
      content => content.type === "tool_use"
    ) as AnthropicToolCall;
    thread.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: "Paris",
        },
      ],
    });
  }

  const finalResponse = await claude.invokeModel({
    max_tokens: 1000,
    temperature: 0,
    system: "You are a helpful assistant.",
    messages: thread,
  });

  console.log(JSON.stringify(finalResponse, null, 2));
}

main();
