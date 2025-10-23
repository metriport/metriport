export interface BasetenConfig {
  maxConcurrentRequests?: number;
  batchSize?: number;
  timeoutInSeconds?: number;
}

export const BASETEN_ENCODING_FORMATS = ["float", "base64"] as const;
export type EmbeddingEncoding = (typeof BASETEN_ENCODING_FORMATS)[number];

export interface EmbeddingConfig<E extends EmbeddingEncoding = "float"> extends BasetenConfig {
  url?: string;
  apiKey?: string;
  model: string;
  encodingFormat?: E;
  /**
   * Allows specification of a "downprojection" of an embedding vector to a lower dimension.
   * If unspecified, this will use the model's default dimension.
   */
  dimensions?: number;
  userIdentifier?: string;
}

export interface EmbeddingResponse<F> {
  model: string;
  usage: {
    total_tokens: number;
  };
  individual_request_times: number[];
  data: {
    index: number;
    embedding: F extends "base64" ? string : number[];
  }[];
}

export interface RerankConfig extends BasetenConfig {
  model: string;
  rawScores?: boolean;
  returnText?: boolean;
  truncate?: boolean;
  truncationDirection?: string;
}
