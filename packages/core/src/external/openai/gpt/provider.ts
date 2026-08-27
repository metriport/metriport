import { Config } from "../../../util/config";
import { OpenAIClientProvider } from "../types";
import { getSecretValueOrFail } from "../../aws/secret-manager";

export async function getApiKeyAndBaseUrl(
  provider: OpenAIClientProvider
): Promise<{ apiKey: string; baseURL: string }> {
  const apiKey = await getApiKeyForProvider(provider);
  const baseURL = getBaseUrlForProvider(provider);

  return {
    apiKey,
    baseURL,
  };
}

function getBaseUrlForProvider(provider: OpenAIClientProvider): string {
  if (provider === "baseten") {
    return Config.getBasetenBaseUrl();
  }
  if (provider === "bedrock") {
    return Config.getBedrockBaseUrl();
  }
  throw new Error(`No base URL registered for ${provider}`);
}

async function getApiKeyForProvider(provider: OpenAIClientProvider): Promise<string> {
  if (provider === "baseten") {
    return await getApiKeyFromEnvOrSecret(
      provider,
      Config.getBasetenApiKey(),
      Config.getBasetenApiKeySecretName()
    );
  }
  if (provider === "bedrock") {
    return await getApiKeyFromEnvOrSecret(
      provider,
      Config.getBedrockApiKey(),
      Config.getBedrockApiKeySecretName()
    );
  }
  throw new Error(`No API key generator for ${provider}`);
}

async function getApiKeyFromEnvOrSecret(
  provider: OpenAIClientProvider,
  apiKey: string | undefined,
  secretName: string | undefined
): Promise<string> {
  if (apiKey) {
    return apiKey;
  }
  if (secretName) {
    return await getSecretValueOrFail(secretName, Config.getAWSRegion());
  }
  throw new Error(`API key or secret name not found for provider: ${provider}`);
}
