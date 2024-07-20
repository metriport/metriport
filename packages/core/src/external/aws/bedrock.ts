import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
const decoder = new TextDecoder();
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../..//util/config";
dayjs.extend(duration);

const region = Config.getMRBriefRegion();
const defaultModelId = Config.getMRBriefModelId();
const defaultVersionPayload = Config.getMRBriefModelVersionPayload();

export function makeBedrockClient(): BedrockRuntimeClient {
  if (!region) throw new Error("No region set");
  return new BedrockRuntimeClient({ region });
}

export class BedrockUtils {
  public readonly _bedrock: BedrockRuntimeClient;
  public readonly _modelId: string;
  public readonly _modelVersion: { [key: string]: string };

  constructor(readonly modelId?: string, modelVersion?: { [key: string]: string }) {
    this._bedrock = makeBedrockClient();
    const targetModelId = modelId ?? defaultModelId;
    if (!targetModelId) throw new Error("No model set");
    this._modelId = targetModelId;
    const targetModelVersion =
      modelVersion ?? (defaultVersionPayload ? JSON.parse(defaultVersionPayload) : undefined);
    if (!targetModelVersion) throw new Error("No model version set");
    this._modelVersion = targetModelVersion;
  }

  get bedrock(): BedrockRuntimeClient {
    return this._bedrock;
  }

  async getBedrockResponse({ prompt, body }: { prompt: string; body: string }) {
    const input = {
      modelId: this._modelId,
      contentType: "application/json",
      accept: "application/json",
      max_tokens: 50,
      body: JSON.stringify({
        ...this._modelVersion,
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
