import { chunkWithOverlap } from "../../../util/string";

/**
 * The usual estimate is every 4 characters is a token.
 */
function getTokenCountForCharacters(characterCount: number): number {
  return Math.ceil(characterCount / 4);
}

/**
 * The usual estimate is every 4 characters is a token.
 */
function getCharacterCountForTokens(tokenCount: number): number {
  return tokenCount * 4;
}

/**
 * Context window sizes for different Claude model versions (in tokens).
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-sonnet-3.7": 200_000,
} as const;

const DEFAULT_SAFETY_MARGIN = 0.9;
const DEFAULT_OVERLAP_RATIO = 0.08;

export type ChunkConfig = {
  chunkSizeChars: number;
  chunkOverlapChars: number;
};

export type ChunkingResult = {
  chunks: string[];
  config: ChunkConfig;
};

/**
 * Calculates chunk configuration based on model version.
 */
export function getChunkConfig(
  modelVersion: string,
  safetyMargin: number = DEFAULT_SAFETY_MARGIN,
  overlapRatio: number = DEFAULT_OVERLAP_RATIO
): ChunkConfig {
  const contextWindowTokens = MODEL_CONTEXT_WINDOWS[modelVersion];
  if (!contextWindowTokens) {
    throw new Error(`Unknown model version: ${modelVersion}`);
  }

  const effectiveTokens = contextWindowTokens * safetyMargin;
  const chunkSizeChars = getCharacterCountForTokens(effectiveTokens);
  const chunkOverlapChars = chunkSizeChars * overlapRatio;

  return {
    chunkSizeChars,
    chunkOverlapChars,
  };
}

/**
 * Chunks text based on model version and returns both chunks and configuration.
 */
export function chunkTextForModel({
  text,
  modelVersion,
  safetyMargin,
  overlapRatio,
}: {
  text: string;
  modelVersion: "claude-sonnet-3.7";
  safetyMargin?: number;
  overlapRatio?: number;
}): string[] {
  const { chunkSizeChars, chunkOverlapChars } = getChunkConfig(
    modelVersion,
    safetyMargin,
    overlapRatio
  );
  const chunks = chunkWithOverlap({
    str: text,
    chunkSize: chunkSizeChars,
    overlapSize: chunkOverlapChars,
  });

  return chunks;
}

/**
 * Estimates token count for a given text.
 */
export function estimateTokenCount(text: string): number {
  return getTokenCountForCharacters(text.length);
}
