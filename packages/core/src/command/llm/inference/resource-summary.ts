import Groq from "groq-sdk";
import { initTimer } from "@metriport/shared/common/timer";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { chunkWithOverlap } from "../../../util/string";
import {
  getResourceSummaryCollationPrompt,
  getResourceSummaryPrompt,
  systemPrompt,
} from "./prompts";

const defaultModel = "openai/gpt-oss-20b";

/**
 * The usual estimate is every 4 characters is a token.
 * @param context
 * @returns
 */
function getTokenCountForCharacters(characterCount: number) {
  return Math.ceil(characterCount / 4);
}

/**
 * The usual estimate is every 4 characters is a token.
 * @param context
 * @returns
 */
function getCharacterCountForTokens(tokenCount: number) {
  return tokenCount * 4;
}

export type ResourceInference = {
  resourceType: string;
  resourceDisplays: string[];
  customPromptSection: string;
  context: string;
  resourceRowData?: Record<string, unknown>;
};

export type SummaryResult = {
  summary: string | undefined;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  chunksDuration?: number;
  collationDuration?: number;
};

type ChunkResult = {
  summary: string;
  inputTokens?: number;
  outputTokens?: number;
};

export async function summarizeContext({
  resourceType,
  resourceDisplays,
  customPromptSection,
  context,
  resourceRowData,
}: ResourceInference): Promise<SummaryResult> {
  const { log } = out(`summarizeContext`);

  // const modelContextWindowTokens = 128_000;
  const modelContextWindowTokens = 8_000;
  const contextWindowSafetyMargin = 0.85;
  const chunkSizeChars = getCharacterCountForTokens(
    modelContextWindowTokens * contextWindowSafetyMargin
  );
  const chunkOverlap = chunkSizeChars * 0.1;
  const chunks = chunkWithOverlap(context, chunkSizeChars, chunkOverlap);
  log(
    `Source context length: ${context.length} characters, or about ${getTokenCountForCharacters(
      context.length
    )} tokens\nSummarizing ${chunks.length} chunks`
  );

  // Track tokens across all calls
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Create all summaries
  const chunksTimer = initTimer();
  const responses = await Promise.all(
    chunks.map(async chunk => {
      const result = await summarizeChunk({
        resourceType,
        resourceDisplays,
        customPromptSection,
        context: chunk,
        ...(resourceRowData ? { resourceRowData } : {}),
      });
      totalInputTokens += result.inputTokens ?? 0;
      totalOutputTokens += result.outputTokens ?? 0;
      return result.summary;
    })
  );
  const chunksDuration = chunksTimer.getElapsedTime();
  console.log(`Chunks processing duration: ${chunksDuration}ms`);

  // Skip collation if there's only one summary we received - faster answer.
  if (responses.length === 1) {
    return {
      summary: responses[0],
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      chunksDuration,
    };
  }

  // Collate summaries
  const collationTimer = initTimer();
  const collationResult = await collateSummaries({
    resourceType,
    resourceDisplays,
    customPromptSection,
    summaries: responses,
    ...(resourceRowData ? { resourceRowData } : {}),
  });
  const collationDuration = collationTimer.getElapsedTime();
  console.log(`Collation duration: ${collationDuration}ms`);

  return {
    summary: collationResult.summary,
    inputTokens: totalInputTokens + (collationResult.inputTokens ?? 0),
    outputTokens: totalOutputTokens + (collationResult.outputTokens ?? 0),
    chunksDuration,
    collationDuration,
  };
}

export async function summarizeChunk({
  resourceType,
  resourceDisplays,
  customPromptSection,
  context,
  resourceRowData,
}: ResourceInference): Promise<ChunkResult> {
  const groq = new Groq({
    apiKey: Config.getGroqApiKey(),
  });

  const prompt = getResourceSummaryPrompt({
    resourceType,
    resourceDisplays,
    customPromptSection,
    context,
    ...(resourceRowData ? { resourceRowData } : {}),
  });

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: defaultModel,
    temperature: 0,
    max_completion_tokens: 8192,
    stream: false,
    stop: null,
  });

  const message = chatCompletion.choices[0]?.message.content ?? "";
  const result: ChunkResult = {
    summary: message,
  };
  if (chatCompletion.usage?.prompt_tokens !== undefined) {
    result.inputTokens = chatCompletion.usage.prompt_tokens;
  }
  if (chatCompletion.usage?.completion_tokens !== undefined) {
    result.outputTokens = chatCompletion.usage.completion_tokens;
  }
  return result;
}

export async function collateSummaries({
  resourceType,
  resourceDisplays,
  customPromptSection,
  summaries,
  resourceRowData,
}: {
  resourceType: string;
  resourceDisplays: string[];
  customPromptSection: string;
  summaries: string[];
  resourceRowData?: Record<string, unknown>;
}): Promise<ChunkResult> {
  const groq = new Groq({
    apiKey: Config.getGroqApiKey(),
  });

  const prompt = getResourceSummaryCollationPrompt({
    resourceType,
    resourceDisplays,
    customPromptSection,
    responses: summaries,
    ...(resourceRowData ? { resourceRowData } : {}),
  });

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: defaultModel,
    temperature: 0,
    max_completion_tokens: 8192,
    top_p: 1,
    stream: false,
    stop: null,
  });

  const message = chatCompletion.choices[0]?.message.content ?? "";
  const result: ChunkResult = {
    summary: message,
  };
  if (chatCompletion.usage?.prompt_tokens !== undefined) {
    result.inputTokens = chatCompletion.usage.prompt_tokens;
  }
  if (chatCompletion.usage?.completion_tokens !== undefined) {
    result.outputTokens = chatCompletion.usage.completion_tokens;
  }
  return result;
}
