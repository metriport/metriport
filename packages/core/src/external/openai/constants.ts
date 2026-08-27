import { OpenAIClientProvider, OpenAIModel } from "./types";

export const DEFAULT_PROVIDER = OpenAIClientProvider.BEDROCK;
export const DEFAULT_MODEL = OpenAIModel.GPT_OSS_120B;
export const DEFAULT_MAX_TOKENS = 65536;
export const DEFAULT_TEMPERATURE = 0;

// Bedrock does not use standard model IDs like other OpenAI providers (e.g. groq, baseten, etc),
// so a mapping is required to map the standard OpenAI model ID to the Bedrock model ID.
export const BEDROCK_MODEL_ID_MAP: Record<OpenAIModel, string | null> = {
  [OpenAIModel.GPT_OSS_120B]: "openai.gpt-oss-120b-1:0",
  [OpenAIModel.GPT_OSS_20B]: "openai.gpt-oss-20b-1:0",
  [OpenAIModel.GLM_4_6_355B]: null,
};
