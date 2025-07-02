import crypto from "crypto";
import { z } from "zod";

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
        name: "inferRxNorm",
        description: "Infer RxNorm entities from the given text",
        schema: z.object({ text: z.string() }),
        execute: async ({ text }: { text: string }) => {
          console.log("inferRxNorm", text);
          return text;
          // const { Entities } = await this.inferRxNorm(text);
          // return Entities;
        },
      },
      {
        name: "inferICD10CM",
        description: "Infer ICD-10-CM entities from the given text",
        schema: z.object({ text: z.string() }),
        execute: async ({ text }: { text: string }) => {
          console.log("inferICD10CM", text);
          return text;
        },
      },
      {
        name: "inferSNOMEDCT",
        description: "Infer SNOMED CT entities from the given text",
        schema: z.object({ text: z.string() }),
        execute: async ({ text }: { text: string }) => {
          console.log("inferSNOMEDCT", text);
          return text;
        },
      },
    ]);
  }

  async comprehendText(text: string): Promise<string> {
    const prompt = `Given the following text, use the following tools to extract structured medical information from the text:
    - The "inferRxNorm" tool extracts medications
    - The "inferICD10CM" tool extracts ICD-10-CM codes
    - The "inferSNOMEDCT" tool extracts SNOMED CT codes
    
    Here is the clinical text to analyze:\n\n${text}`;
    const response = await this.bedrock.invoke(prompt);

    const toolCalls = response.tool_calls ?? [];
    console.log("toolCalls", toolCalls);

    for (const toolCall of toolCalls) {
      if (toolCall.name === "inferRxNorm") {
        const { text } = toolCall.args;
        const { Entities } = await this.inferRxNorm(text);
        console.log("rxnorm", Entities);
      } else if (toolCall.name === "inferICD10CM") {
        const { text } = toolCall.args;
        const { Entities } = await this.inferICD10CM(text);
        console.log("icd10", Entities);
      } else if (toolCall.name === "inferSNOMEDCT") {
        const { text } = toolCall.args;
        const { Entities } = await this.inferSNOMEDCT(text);
        console.log("snomed", Entities);
      }
    }

    console.log("response", response);

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
