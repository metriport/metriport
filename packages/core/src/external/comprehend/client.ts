import crypto from "crypto";
import { z } from "zod";
import { BaseMessageLike } from "@langchain/core/messages";

import {
  ComprehendMedicalClient,
  DetectEntitiesV2Command,
  DetectEntitiesV2CommandOutput,
  InferRxNormCommand,
  InferRxNormCommandOutput,
  InferICD10CMCommand,
  InferICD10CMCommandOutput,
  InferSNOMEDCTCommand,
  InferSNOMEDCTCommandOutput,
} from "@aws-sdk/client-comprehendmedical";
import { Config } from "../../util/config";
import { buildEntityGraph } from "./entity-graph";
import { EntityGraph } from "./types";
import { BedrockChat } from "../langchain/bedrock";
// import { buildPrompt } from "./prompt";

export class ComprehendClient {
  private bedrock: ReturnType<typeof BedrockChat.prototype.bindTools>;
  private comprehend: ComprehendMedicalClient;
  private totalTokensUsed: { input: number; output: number } = { input: 0, output: 0 };

  constructor({
    comprehendRegion = Config.getAWSComprehendRegion(),
  }: // bedrockRegion = Config.getAWSRegion()
  { comprehendRegion?: string } = {}) {
    this.comprehend = new ComprehendMedicalClient({
      region: comprehendRegion,
    });

    const bedrockChat = new BedrockChat({
      model: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
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

    this.bedrock = bedrockChat.bindTools([
      {
        name: "extractMedications",
        description: "Extract medication information using RxNorm codes",
        schema: z.object({ text: z.string() }),
      },
      {
        name: "extractConditions",
        description: "Extract medical conditions with ICD-10-CM codes",
        schema: z.object({ text: z.string() }),
      },
      {
        name: "extractProcedures",
        description: "Extract medical procedures with SNOMED CT codes",
        schema: z.object({ text: z.string() }),
      },
    ]);
  }

  async comprehendText(text: string): Promise<string> {
    const prompt = `You are an agent that passes a related chunk of medical information from the given text to an extraction tool for
    further processing. You should call tools with substrings of the provided clinical text. You should only pass relevant text to the tools. Do not perform any inference, make any transformations or modifications to the
    original text, or attempt to add any medical coding.

    - The "extractConditions" tool extracts conditions with ICD-10-CM codes
    - The "extractProcedures" tool extracts procedures with SNOMED CT codes
    - The "extractMedications" tool extracts medication information using RxNorm codes
    
    Here is the clinical text to analyze:\n\n"${text}"`;

    const response = (await this.bedrock.invoke(prompt)) as Awaited<
      ReturnType<typeof BedrockChat.prototype.invoke>
    >;

    const toolCalls = response.tool_calls ?? [];
    const firstToolCall = toolCalls[0];

    if (!firstToolCall) {
      console.log("No tools were called");
      return "No tools were called";
    }

    console.log("firstToolCall", firstToolCall, toolCalls.length);

    let nextToolCall: typeof firstToolCall | null = null;
    const conversation: BaseMessageLike[] = [
      prompt,
      response,
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: firstToolCall.id,
          },
        ],
      },
    ];

    do {
      console.log("Invoking with tool response");
      const nextResponse = (await this.bedrock.invoke(conversation)) as Awaited<
        ReturnType<typeof BedrockChat.prototype.invoke>
      >;
      nextToolCall = nextResponse.tool_calls?.[0] ?? null;
      console.log("nextToolCall", nextToolCall, nextResponse.tool_calls?.length ?? 0);
      if (nextToolCall) {
        conversation.push(nextResponse);
        conversation.push({
          type: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: nextToolCall.id,
            },
          ],
        });
      }
    } while (nextToolCall != null);

    return "done";
  }

  async buildEntityGraph(text: string): Promise<EntityGraph | undefined> {
    const { Entities } = await this.detectEntities(text);
    const entityGraph = buildEntityGraph(Entities ?? []);
    return entityGraph;
  }

  async inferRxNorm(text: string): Promise<InferRxNormCommandOutput> {
    const command = new InferRxNormCommand({
      Text: text,
    });
    const response = await this.comprehend.send(command);
    return response;
  }

  async inferICD10CM(text: string): Promise<InferICD10CMCommandOutput> {
    const command = new InferICD10CMCommand({
      Text: text,
    });
    const response = await this.comprehend.send(command);
    return response;
  }

  async inferSNOMEDCT(text: string): Promise<InferSNOMEDCTCommandOutput> {
    const command = new InferSNOMEDCTCommand({
      Text: text,
    });
    const response = await this.comprehend.send(command);
    return response;
  }

  async detectEntities(text: string): Promise<DetectEntitiesV2CommandOutput> {
    const command = new DetectEntitiesV2Command({
      Text: text,
    });
    const startTime = Date.now();
    const response = await this.comprehend.send(command);
    const endTime = Date.now();
    console.log(`Comprehend detected entities in ${endTime - startTime}ms`);
    return response;
  }

  getCacheKey(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }
}
