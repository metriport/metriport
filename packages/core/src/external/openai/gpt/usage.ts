import { OpenAIResponse, OpenAIUsage } from "../types";

export function buildInitialUsage(): OpenAIUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
  };
}

export function incrementUsage(usage: OpenAIUsage, response: OpenAIResponse): OpenAIUsage {
  return {
    inputTokens: usage.inputTokens + (response.usage?.prompt_tokens ?? 0),
    outputTokens: usage.outputTokens + (response.usage?.completion_tokens ?? 0),
  };
}
