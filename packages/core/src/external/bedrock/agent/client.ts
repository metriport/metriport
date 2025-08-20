import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export type BedrockRegion = "us-east-1" | "us-east-2" | "us-west-2";

/**
 * A basic client for invoking Bedrock models. See the model/ directory for specialized clients.
 */
export class BedrockClient<I = unknown, O = unknown> {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor({ model, region }: { model: string; region: BedrockRegion }) {
    this.client = new BedrockRuntimeClient({ region });
    this.modelId = model;
  }

  /**
   * Invokes a model with the given request body, and returns an unknown response body.
   * The shape of the request and response bodies varies based on the model ID.
   * @param body - The body of the request
   * @returns The model response
   */
  async invokeModel(body: I): Promise<O> {
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify(body),
    });
    const response = await this.client.send(command);
    const responseBody = response.body?.transformToString();
    return JSON.parse(responseBody) as O;
  }
}
