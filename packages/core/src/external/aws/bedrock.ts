import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { Config } from "../..//util/config";

const decoder = new TextDecoder();
const region = Config.getBedrockRegion();
const defaultModelId = Config.getMrBriefModelId();
const defaultBedrockVersion = Config.getBedrockVersion();

export function makeBedrockClient(): BedrockRuntimeClient {
  if (!region) throw new Error("No region set");
  return new BedrockRuntimeClient({ region });
}

export class BedrockUtils {
  public readonly _bedrock: BedrockRuntimeClient;
  public readonly _modelId: string;
  public readonly _bedrockVersion: string;

  constructor(readonly modelId?: string, modelVersion?: string) {
    this._bedrock = makeBedrockClient();
    const targetModelId = modelId ?? defaultModelId;
    if (!targetModelId) throw new Error("No model set");
    this._modelId = targetModelId;
    const targetBedrockVersion = modelVersion ?? defaultBedrockVersion;
    if (!targetBedrockVersion) throw new Error("No model version set");
    this._bedrockVersion = targetBedrockVersion;
  }

  get bedrock(): BedrockRuntimeClient {
    return this._bedrock;
  }

  // TODO: Define return type
  async getBedrockResponse({ prompt, body }: { prompt: string; body: string }) {
    const input = {
      modelId: this._modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropicVersion: this._bedrockVersion,
        max_tokens: 1000,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "text", text: body },
            ],
          },
        ],
      }),
    };
    const command = new InvokeModelCommand(input);
    const response = await this.bedrock.send(command);
    return JSON.parse(decoder.decode(response.body));
  }
}
