import { OpenAI } from "openai";
import {
  OpenAIRequest,
  OpenAIResponse,
  OpenAIClientProvider,
  OpenAIModel,
  OpenAIClientConfig,
} from "./types";
import { getApiKeyAndBaseUrl } from "./gpt/provider";
import { DEFAULT_MODEL, DEFAULT_PROVIDER, BEDROCK_MODEL_ID_MAP } from "./constants";

/**
 * Builds an OpenAIClient instance based on the given provider and configuration.
 * @param provider - The provider to use for the client.
 * @param config - The configuration for the client.
 * @returns An OpenAIClient instance.
 */
export async function buildOpenAIClient(
  provider: OpenAIClientProvider = DEFAULT_PROVIDER,
  config: Partial<OpenAIClientConfig> = { model: DEFAULT_MODEL }
): Promise<OpenAIClient> {
  const { apiKey, baseURL } = await getApiKeyAndBaseUrl(provider);
  return new OpenAIClient({
    apiKey,
    baseURL,
    model: config.model ?? DEFAULT_MODEL,
    provider,
  });
}

/**
 * A basic client for invoking OpenAI models.
 */
export class OpenAIClient {
  private client: OpenAI;
  private model: OpenAIModel;
  private provider: OpenAIClientProvider;

  constructor({ apiKey, baseURL, model, provider }: OpenAIClientConfig) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
    this.provider = provider;
  }

  async invokeModel(request: OpenAIRequest): Promise<OpenAIResponse> {
    const response = await this.client.chat.completions.create({
      model: this.getModelId(),
      ...request,
    });
    return response;
  }

  private getModelId() {
    // Bedrock does not use standard model IDs like other OpenAI providers (e.g. groq, baseten, etc)
    if (this.provider === OpenAIClientProvider.BEDROCK) {
      const bedrockModel = BEDROCK_MODEL_ID_MAP[this.model];
      if (!bedrockModel) {
        throw new Error(`Unsupported Bedrock model: ${this.model}`);
      }
      return bedrockModel;
    }
    return this.model;
  }
}
