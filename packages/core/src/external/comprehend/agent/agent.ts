import { Bundle } from "@medplum/fhirtypes";
import { BedrockChat } from "../../langchain/bedrock";
import { ComprehendClient } from "../client";
import { BEDROCK_MODEL } from "../constants";
import { ExtractionFeature, ExtractionToolCall } from "../types";
import {
  BedrockAgent,
  BedrockChatThread,
  BedrockChatResult,
  ExtractionBudget,
  ExtractionUsage,
} from "./types";
import { buildBundleFromEntityGraph, buildEntityGraph } from "../entity-graph";
import { buildChatThread } from "./prompt";
import { buildUsage, withinBudget, defaultBudget } from "./budget";
import { buildExtractionToolCall, buildExtractionToolResult, buildToolDefinition } from "./tools";
import { buildUsageCallback } from "./callbacks";

export class ComprehendAgent {
  private client: ComprehendClient;
  private features: ExtractionFeature[];
  private bedrock: BedrockAgent;
  private usage: ExtractionUsage = buildUsage();

  constructor(client: ComprehendClient, features: ExtractionFeature[]) {
    this.client = client;
    this.features = features;

    console.log(this.client != null);

    const bedrockChat = new BedrockChat({
      model: BEDROCK_MODEL,
      temperature: 0,
      region: "us-east-2",
      callbacks: [buildUsageCallback(this)],
    });

    this.bedrock = bedrockChat.bindTools(features.map(feature => buildToolDefinition(feature)));
  }

  private async continueExtraction(
    chatThread: BedrockChatThread
  ): Promise<ExtractionToolCall[] | undefined> {
    const response: BedrockChatResult = await this.bedrock.invoke(chatThread);
    chatThread.push(response);
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return undefined;
    }
    // Add all tool calls, followed by an empty result for each tool call
    const toolCalls: ExtractionToolCall[] = [];
    for (const toolCall of response.tool_calls) {
      toolCalls.push(buildExtractionToolCall(toolCall));
    }
    for (const toolCall of response.tool_calls) {
      chatThread.push(buildExtractionToolResult(toolCall));
    }
    return toolCalls;
  }

  // private async runToolCalls(toolCalls: ExtractionToolCall[], entityGraph: EntityGraph) {
  //   return Promise.all(toolCalls.map(toolCall => this.runToolCall(toolCall, entityGraph)));
  // }

  // private async runToolCall(toolCall: ExtractionToolCall, entityGraph: EntityGraph) {
  //   switch (toolCall.type) {
  //     case "medication":
  //       const result = await this.client.inferRxNorm(toolCall.text);
  //       result.Entities?.forEach(entity => {
  //         entityGraph.medications.push({
  //           id: entity.Id,
  //           name: entity.Text,
  //           code: entity.Code,
  //           confidence: entity.Score,
  //         });
  //       });
  //       break;
  //     case "condition":
  //       await this.client.inferICD10CM(toolCall.text);
  //       break;
  //     case "procedure":
  //       await this.client.inferSNOMEDCT(toolCall.text);
  //       break;
  //   }
  // }

  async extractFhir(
    text: string,
    budget: ExtractionBudget = defaultBudget
  ): Promise<Bundle | undefined> {
    const entityGraph = buildEntityGraph();
    const chatThread = buildChatThread(text, this.features);
    let toolCalls = await this.continueExtraction(chatThread);
    if (!toolCalls) return undefined;

    do {
      console.log("Running LLM extraction");
      toolCalls = await this.continueExtraction(chatThread);
      if (!toolCalls) break;
    } while (withinBudget(this.usage, budget));

    return buildBundleFromEntityGraph(entityGraph);
  }

  withinBudget(usage: ExtractionUsage, budget: ExtractionBudget) {
    return (
      usage.llmInputTokens < budget.tokensToLLM &&
      usage.comprehendInputCharacters < budget.charactersToComprehend
    );
  }

  incrementLLMUsage(usage: { input_tokens: number; output_tokens: number }) {
    this.usage.llmInputTokens += usage.input_tokens;
    this.usage.llmOutputTokens += usage.output_tokens;
  }

  incrementToolUsage(toolName: string, input: string) {
    this.usage.comprehendInputCharacters += input.length;
  }
}
