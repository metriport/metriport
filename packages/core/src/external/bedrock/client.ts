import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockConfig, InvokeRequest, InvokeResponse } from "./types";
import { ANTHROPIC_BEDROCK_VERSION } from "./constants";

export class BedrockClient {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor(config: BedrockConfig) {
    this.modelId = config.model;
    this.client = new BedrockRuntimeClient({ region: config.region });
  }

  async invokeModel(body: InvokeRequest): Promise<InvokeResponse> {
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify({
        anthropic_version: ANTHROPIC_BEDROCK_VERSION,
        ...body,
      }),
    });
    const response = await this.client.send(command);
    if (!response.body) throw new Error("No response body");
    const responseBody = response.body.transformToString();
    if (!responseBody) throw new Error("invalid response body");
    return JSON.parse(responseBody) as InvokeResponse;
  }
}
