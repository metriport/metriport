import {
  BasetenConfig,
  EmbeddingData,
  TextWithEmbedding,
  TextWithIndex,
  TextWithIndexAndEmbedding,
} from "./types";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONCURRENCY,
  DEFAULT_TIMEOUT_SECONDS,
  MAX_BATCH_SIZE,
  MAX_CONCURRENCY,
  MAX_TIMEOUT_SECONDS,
} from "./constants";

/**
 * Specifies the size of batched requests to the Baseten API.
 * @param config - The embedding configuration.
 * @returns The batch size.
 */
export function getBatchSize(config: BasetenConfig): number {
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(batchSize, MAX_BATCH_SIZE));
}

/**
 * Specifies the maximum number of concurrent requests to the Baseten API.
 * @param config - The embedding configuration.
 * @returns The maximum number of concurrent requests.
 */
export function getMaxConcurrentRequests(config: BasetenConfig): number {
  const concurrency = config.maxConcurrentRequests ?? DEFAULT_CONCURRENCY;
  return Math.max(1, Math.min(concurrency, MAX_CONCURRENCY));
}

/**
 * Specifies the timeout for requests to the Baseten API.
 * @param config - The embedding configuration.
 * @returns The timeout in seconds.
 */
export function getTimeoutSeconds(config: BasetenConfig): number {
  const timeoutSeconds = config.timeoutInSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  return Math.max(1, Math.min(timeoutSeconds, MAX_TIMEOUT_SECONDS));
}

export function createTextWithEmbedding(
  data: EmbeddingData,
  texts: string[]
): TextWithEmbedding | undefined {
  const text = texts[data.index];
  if (!text) return undefined;
  return {
    text,
    embedding: data.embedding,
  };
}

export function createTextWithIndexAndEmbedding(
  data: EmbeddingData,
  textsWithIndex: TextWithIndex[]
): TextWithIndexAndEmbedding | undefined {
  const textWithIndex = textsWithIndex[data.index];
  if (!textWithIndex) return undefined;
  return {
    text: textWithIndex.text,
    index: textWithIndex.index,
    embedding: data.embedding,
  };
}
