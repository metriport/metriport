import { getAnthropicModelId } from "../../external/bedrock/model/anthropic/version";
import { BedrockChat } from "../../external/langchain/bedrock";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Callbacks } from "@langchain/core/callbacks/manager";
import { ChatOpenAI, ChatOpenAICallOptions } from "../../external/langchain/openai";
import { isAiBriefV2FeatureFlagEnabledForCx } from "../feature-flags/domain-ffs";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";
import { AiBriefControls, AiBriefModel, AiBriefProvider } from "./shared";
import { Config } from "../../util/config";
import {
  AI_BRIEF_V1_MODEL,
  AI_BRIEF_V2_MODEL,
  AI_BRIEF_V2_ENCODING_MODEL_NAME,
  AI_BRIEF_V2_PROVIDER,
} from "./shared";

const AI_BRIEF_V2_MAX_TOKENS = 65536;

export async function getAiBriefModel(
  cxId: string,
  controls?: AiBriefControls
): Promise<AiBriefModel> {
  // If a model is explicitly set in the AI brief controls, it is usually from the
  // summary utils scripts which are used to compare different models against the same CX.
  if (controls?.model) {
    return controls.model;
  }
  const isAiBriefV2 = await isAiBriefV2FeatureFlagEnabledForCx(cxId);
  return isAiBriefV2 ? AI_BRIEF_V2_MODEL : AI_BRIEF_V1_MODEL;
}

/**
 * Returns a base LangChain chat model instance for the given provider, which is compatible with the LLMChain
 * and other existing map reduce implementations.
 */
export async function getBaseChatModel(
  model: AiBriefModel,
  callbacks: Callbacks
): Promise<BaseChatModel> {
  // Use the existing Bedrock chat model for non-V2 AI briefs.
  if (model === AI_BRIEF_V1_MODEL) {
    return new BedrockChat({
      model: getAnthropicModelId("claude-sonnet-3.5"),
      temperature: 0,
      region: "us-west-2",
      callbacks,
    });
  }

  const { apiKey, baseURL } = await getApiKeyAndBaseUrl(AI_BRIEF_V2_PROVIDER);
  return new ChatOpenAI<ChatOpenAICallOptions>({
    apiKey,
    model,
    // required for js-tiktoken to work correctly
    modelName: AI_BRIEF_V2_ENCODING_MODEL_NAME,
    maxTokens: AI_BRIEF_V2_MAX_TOKENS,
    temperature: 0,
    configuration: {
      baseURL,
    },
    callbacks: callbacks as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  }) as unknown as BaseChatModel;
}

async function getApiKeyAndBaseUrl(
  provider: AiBriefProvider
): Promise<{ apiKey: string; baseURL: string }> {
  let apiKey: string | undefined;
  let baseURL: string | undefined;

  if (provider === "baseten") {
    apiKey = Config.getBasetenApiKey();
    baseURL = Config.getBasetenBaseUrl();
    const apiKeySecretName = Config.getBasetenApiKeySecretName();
    if (!apiKey && apiKeySecretName) {
      apiKey = await getSecretValueOrFail(apiKeySecretName, Config.getAWSRegion());
    }
  } else if (provider === "bedrock") {
    apiKey = Config.getBedrockApiKey();
    baseURL = Config.getBedrockBaseUrl();
    const apiKeySecretName = Config.getBedrockApiKeySecretName();
    if (!apiKey && apiKeySecretName) {
      apiKey = await getSecretValueOrFail(apiKeySecretName, Config.getAWSRegion());
    }
  }

  if (!apiKey || !baseURL) {
    throw new Error(`API key or base URL not found for provider: ${provider}`);
  }

  return { apiKey, baseURL };
}
