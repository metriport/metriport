export interface EmbeddingConfig {
  model: string;
  encodingFormat?: string;
  dimensions?: number;
  userIdentifier?: string;
  maxConcurrentRequests?: number;
  batchSize?: number;
  timeoutInSeconds?: number;
}
