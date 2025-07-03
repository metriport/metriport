import { z } from "zod";
import { BaseMessageLike } from "@langchain/core/messages";
import { Bundle } from "@medplum/fhirtypes";
import { ToolCall } from "@langchain/core/messages/tool";
import { BedrockChat } from "../../langchain/bedrock";
import { BEDROCK_MODEL } from "../constants";
import {
  ExtractionFeature,
  BedrockAgent,
  BedrockChatResult,
  ExtractionBudget,
  ExtractionUsage,
} from "../types";
import { buildBundleFromEntityGraph, buildEntityGraph } from "../entity-graph";
import { buildPrompt, getToolDescription, getToolName } from "./prompt";
import { buildUsage, incrementLLMUsage, withinBudget, defaultBudget } from "./budget";

export class ComprehendAgent {
  private features: ExtractionFeature[];
  private bedrock: BedrockAgent;
  private usage: ExtractionUsage = buildUsage();

  constructor(features: ExtractionFeature[]) {
    this.features = features;

    const bedrockChat = new BedrockChat({
      model: BEDROCK_MODEL,
      temperature: 0,
      region: "us-east-2",
      callbacks: [
        {
          handleLLMEnd: output => {
            const usage = output.llmOutput?.usage;
            if (usage) {
              incrementLLMUsage(this.usage, usage);
            }
          },
        },
        {
          handleToolStart(tool, input, runId, parentRunId, tags, metadata, runName) {
            console.log("Tool started", tool, input, runId, parentRunId, tags, metadata, runName);
          },
        },
        {
          handleToolError: error => {
            console.error("Error in tool", error);
          },
        },
        {
          handleToolEnd: output => {
            console.log("Tool ended", output);
          },
        },
        {
          handleLLMError: error => {
            console.error("Error in LLM", error);
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

  async extractFhir(
    text: string,
    budget: ExtractionBudget = defaultBudget
  ): Promise<Bundle | undefined> {
    const prompt = buildPrompt(text, this.features);
    const conversation: BaseMessageLike[] = [prompt];
    const entityGraph = buildEntityGraph();

    do {
      console.log("Running LLM extraction");
      const response: BedrockChatResult = await this.bedrock.invoke(conversation);

      if (response.tool_calls && response.tool_calls.length > 0) {
        conversation.push(response);

        // Add tool calls to the conversation
        for (const toolCall of response.tool_calls) {
          // TODO: use the tool to build a graph
          conversation.push(buildToolResult(toolCall));
        }
      } else break;
    } while (withinBudget(this.usage, budget));

    return buildBundleFromEntityGraph(entityGraph);
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
