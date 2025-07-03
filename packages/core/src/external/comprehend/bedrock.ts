// import { ComprehendClient } from "./client";
import { BedrockChat } from "../langchain/bedrock";
import { BEDROCK_MODEL } from "./constants";
import { z } from "zod";
import { ExtractionFeature } from "./types";
import { buildPrompt, getToolDescription, getToolName } from "./prompt";
import { BaseMessageLike } from "@langchain/core/messages";
import { Bundle } from "@medplum/fhirtypes";
import { ToolCall } from "@langchain/core/messages/tool";

export class ComprehendBedrockChat {
  private bedrock: ReturnType<typeof BedrockChat.prototype.bindTools>;
  private totalTokensUsed: { input: number; output: number } = { input: 0, output: 0 };

  constructor(features: ExtractionFeature[]) {
    const bedrockChat = new BedrockChat({
      model: BEDROCK_MODEL,
      temperature: 0,
      region: "us-east-2",
      callbacks: [
        {
          handleLLMEnd: output => {
            const usage = output.llmOutput?.usage;
            if (usage) {
              console.log("usage", usage);
              this.totalTokensUsed.input += usage.input_tokens;
              this.totalTokensUsed.output += usage.output_tokens;
            }
          },
        },
      ],
    });

    this.bedrock = bedrockChat.bindTools(
      features.map(feature => ({
        name: getToolName(feature),
        description: getToolDescription(feature),
        schema: z.object({ text: z.string() }),
      }))
    );
  }

  async comprehendTextAsFhir(
    text: string,
    features: ExtractionFeature[]
  ): Promise<Bundle | undefined> {
    const prompt = buildPrompt(text, features);

    const response = (await this.bedrock.invoke(prompt)) as Awaited<
      ReturnType<typeof BedrockChat.prototype.invoke>
    >;

    const toolCalls = response.tool_calls ?? [];
    const firstToolCall = toolCalls[0];
    if (!firstToolCall) {
      console.log("No extraction features were found in the text");
      return undefined;
    }

    let currentToolCall: ToolCall | undefined = firstToolCall;
    const conversation: BaseMessageLike[] = [prompt, response];

    do {
      console.log("Invoking with tool response");
      conversation.push(buildToolResult(currentToolCall));
      const nextResponse = (await this.bedrock.invoke(conversation)) as Awaited<
        ReturnType<typeof BedrockChat.prototype.invoke>
      >;
      currentToolCall = nextResponse.tool_calls?.[0] ?? undefined;
    } while (currentToolCall != null);

    return undefined;
  }
}

function buildToolResult(toolCall: ToolCall) {
  return {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolCall.id,
      },
    ],
  };
}
