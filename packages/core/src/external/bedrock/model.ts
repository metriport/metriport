import { BedrockClient } from "./client";
import { BedrockRegion } from "./types";

export class BedrockModel<I, O> {
  private client: BedrockClient;

  constructor(modelId: string, region: BedrockRegion) {
    this.client = new BedrockClient({ region, model: modelId });
  }

  async invoke(input: I): Promise<O> {
    const start = Date.now();
    const response = (await this.client.invokeModel(input as Record<string, unknown>)) as Record<
      string,
      unknown
    >;
    response["meta"] = {
      duration: Date.now() - start,
    };
    return response as O;
  }
}
