import { PerformanceClient } from "@basetenlabs/performance-client";
import { Config } from "../../util/config";
import { EmbeddingConfig, EmbeddingResponse } from "./types";
import { getBatchSize, getMaxConcurrentRequests, getTimeoutSeconds } from "./utils";
import { EMBEDDING_ENCODING_FORMAT } from "./constants";

export class EmbeddingClient {
  private client: PerformanceClient;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    const url = config.url ?? Config.getBasetenEmbeddingUrl();
    const apiKey = config.apiKey ?? Config.getBasetenApiKey();
    this.client = new PerformanceClient(url, apiKey);
    this.config = config;
  }

  async createEmbeddings(texts: string[]): Promise<EmbeddingResponse> {
    const batchSize = getBatchSize(this.config);
    const maxConcurrentRequests = getMaxConcurrentRequests(this.config);
    const timeoutSeconds = getTimeoutSeconds(this.config);

    const response: EmbeddingResponse = await this.client.embed(
      texts,
      this.config.model,
      EMBEDDING_ENCODING_FORMAT,
      this.config.dimensions,
      this.config.userIdentifier,
      maxConcurrentRequests,
      batchSize,
      timeoutSeconds
    );
    return response;
  }
}
