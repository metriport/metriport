import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockConfig } from "./types";

/**
 * A basic client for invoking Bedrock models. See the model/ directory for specialized clients.
 */
export class BedrockClient {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor(config: BedrockConfig) {
    this.client = new BedrockRuntimeClient({ region: config.region });
    this.modelId = config.model;
  }

  /**
   * Invokes a model with the given request body, and returns an unknown response body.
   * The shape of the request and response bodies varies based on the model ID.
   * @param body - The body of the request
   * @returns The model response
   */
  async invokeModel(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify(body),
    });
    const response = await this.client.send(command);
    if (!response.body) throw new Error("No response body");
    const responseBody = response.body.transformToString();
    if (!responseBody) throw new Error("invalid response body");
    return JSON.parse(responseBody);
  }
}
