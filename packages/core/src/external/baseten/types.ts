export interface EmbeddingConfig {
  url?: string;
  apiKey?: string;
  model: string;
  encodingFormat?: string;
  dimensions?: number;
  userIdentifier?: string;
  maxConcurrentRequests?: number;
  batchSize?: number;
  timeoutInSeconds?: number;
}

export interface RerankConfig {
  model: string;
  rawScores?: boolean;
  returnText?: boolean;
  truncate?: boolean;
  truncationDirection?: string;
  maxConcurrentRequests?: number;
  batchSize?: number;
  timeoutInSeconds?: number;
}
