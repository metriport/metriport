export interface BasetenConfig {
  maxConcurrentRequests?: number;
  batchSize?: number;
  timeoutInSeconds?: number;
}

export interface EmbeddingConfig extends BasetenConfig {
  url?: string;
  apiKey?: string;
  model: string;
  /**
   * Allows specification of a "downprojection" of an embedding vector to a lower dimension.
   * If unspecified, this will use the model's default dimension.
   */
  dimensions?: number;
  userIdentifier?: string;
}

export interface EmbeddingResponse {
  object: "list";
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  total_time: number;
  individual_request_times: number[];
  data: EmbeddingData[];
}

export interface EmbeddingData {
  object: "embedding";
  index: number;
  embedding: number[];
}

export interface RerankConfig extends BasetenConfig {
  model: string;
  rawScores?: boolean;
  returnText?: boolean;
  truncate?: boolean;
  truncationDirection?: string;
}
