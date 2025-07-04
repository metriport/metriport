import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { AnthropicModel } from "./constants";
import { InvokeRequest, InvokeResponse } from "./types";

export class BedrockClient {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor(modelId: string, region: string) {
    this.modelId = modelId;
    this.client = new BedrockRuntimeClient({ region });
  }

  static claudeSonnet(region: string, version: "3.5" | "3.7" = "3.5"): BedrockClient {
    if (version === "3.5") {
      return new BedrockClient(AnthropicModel.CLAUDE_3_5_SONNET, region);
    } else {
      return new BedrockClient(AnthropicModel.CLAUDE_3_7_SONNET, region);
    }
  }

  async invokeModel(body: InvokeRequest): Promise<InvokeResponse> {
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31", // required value
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
