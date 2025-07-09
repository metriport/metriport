import { BedrockModel } from "../model";
import { BedrockRegion } from "../types";

import { AnthropicModelVersion, getAnthropicModelId } from "./anthropic/version";
import { AnthropicRequest } from "./anthropic/request";
import { AnthropicResponse } from "./anthropic/response";

export class AnthropicModel<V extends AnthropicModelVersion> extends BedrockModel<
  AnthropicRequest<V>,
  AnthropicResponse<V>
> {
  version: V;

  constructor(version: V, region: BedrockRegion) {
    super(getAnthropicModelId(version), region);
    this.version = version;
  }

  override async invoke(input: AnthropicRequest<V>): Promise<AnthropicResponse<V>> {
    return super.invoke({
      anthropic_version: "bedrock-2023-05-31",
      ...input,
    });
  }
}
