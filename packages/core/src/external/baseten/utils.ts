import { EmbeddingConfig } from "./types";
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
export function getBatchSize(config: EmbeddingConfig): number {
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(batchSize, MAX_BATCH_SIZE));
}

/**
 * Specifies the maximum number of concurrent requests to the Baseten API.
 * @param config - The embedding configuration.
 * @returns The maximum number of concurrent requests.
 */
export function getMaxConcurrentRequests(config: EmbeddingConfig): number {
  const concurrency = config.maxConcurrentRequests ?? DEFAULT_CONCURRENCY;
  return Math.max(1, Math.min(concurrency, MAX_CONCURRENCY));
}

/**
 * Specifies the timeout for requests to the Baseten API.
 * @param config - The embedding configuration.
 * @returns The timeout in seconds.
 */
export function getTimeoutSeconds(config: EmbeddingConfig): number {
  const timeoutSeconds = config.timeoutInSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  return Math.max(1, Math.min(timeoutSeconds, MAX_TIMEOUT_SECONDS));
}
