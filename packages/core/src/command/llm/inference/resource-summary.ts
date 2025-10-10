import Groq from "groq-sdk";
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
function getCharacterCountForTokens(tokenCount: number) {
  return tokenCount * 4;
}

export type ResourceInference = {
  resourceType: string;
  resourceDisplays: string[];
  questions: string[];
  context: string;
};

export async function summarizeContext({
  resourceType,
  resourceDisplays,
  questions,
  context,
}: ResourceInference): Promise<string | undefined> {
  const { log } = out(`summarizeContext`);

  const modelContextWindowTokens = 128_000;
  const contextWindowSafetyMargin = 0.85;
  const chunkSizeChars = getCharacterCountForTokens(
    modelContextWindowTokens * contextWindowSafetyMargin
  );
  const chunkOverlap = chunkSizeChars * 0.1;
  const chunks = chunkWithOverlap(context, chunkSizeChars, chunkOverlap);
  log(`Source context length: ${context.length} characters\nSummarizing ${chunks.length} chunks`);

  // Create all summaries
  const responses = await Promise.all(
    chunks.map(chunk =>
      summarizeChunk({ resourceType, resourceDisplays, questions, context: chunk })
    )
  );

  // Collate summaries
  return await collateSummaries({
    resourceType,
    resourceDisplays,
    questions,
    summaries: responses,
  });
}

export async function summarizeChunk({
  resourceType,
  resourceDisplays,
  questions,
  context,
}: ResourceInference): Promise<string> {
  const groq = new Groq();

  const prompt = getResourceSummaryPrompt({ resourceType, resourceDisplays, questions, context });

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
  return message;
}

export async function collateSummaries({
  resourceType,
  resourceDisplays,
  questions,
  summaries,
}: {
  resourceType: string;
  resourceDisplays: string[];
  questions: string[];
  summaries: string[];
}): Promise<string> {
  const groq = new Groq();

  const prompt = getResourceSummaryCollationPrompt({
    resourceType,
    resourceDisplays,
    questions,
    responses: summaries,
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
  return message;
}
