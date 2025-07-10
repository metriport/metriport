import { BedrockClient, BedrockRegion } from "../client";
import { AnthropicModelVersion, getAnthropicModelId } from "./anthropic/version";
import { AnthropicRequest } from "./anthropic/request";
import { AnthropicResponse } from "./anthropic/response";

export class AnthropicModel<V extends AnthropicModelVersion> extends BedrockClient<
  AnthropicRequest<V>,
  AnthropicResponse<V>
> {
  version: V;

  constructor(version: V, region: BedrockRegion) {
    super({
      model: getAnthropicModelId(version),
      region,
    });
    this.version = version;
  }

  override async invokeModel(input: AnthropicRequest<V>): Promise<AnthropicResponse<V>> {
    return super.invokeModel({
      anthropic_version: "bedrock-2023-05-31",
      ...input,
    });
  }
}
