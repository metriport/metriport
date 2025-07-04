import { ExtractionBudget, ExtractionUsage } from "./types";

export function withinBudget(usage: ExtractionUsage, budget: ExtractionBudget) {
  return (
    usage.llmInputTokens < budget.tokensToLLM &&
    usage.comprehendInputCharacters < budget.charactersToComprehend
  );
}

export const defaultBudget: ExtractionBudget = {
  tokensToLLM: 10000,
  charactersToComprehend: 1000,
};

export function buildUsage(): ExtractionUsage {
  return {
    llmInputTokens: 0,
    llmOutputTokens: 0,
    comprehendInputCharacters: 0,
  };
}

export function incrementLLMUsage(
  usage: ExtractionUsage,
  llmUsage: {
    input_tokens: number;
    output_tokens: number;
  }
) {
  usage.llmInputTokens += llmUsage.input_tokens;
  usage.llmOutputTokens += llmUsage.output_tokens;
}

export function incrementComprehendUsage(usage: ExtractionUsage, textToComprehend: string) {
  usage.comprehendInputCharacters += textToComprehend.length;
}
