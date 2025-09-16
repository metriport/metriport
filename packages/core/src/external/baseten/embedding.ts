import { PerformanceClient } from "@basetenlabs/performance-client";
import { Config } from "../../util/config";
import { EmbeddingConfig } from "./types";

export class EmbeddingClient {
  private client: PerformanceClient;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    const url = config.url ?? Config.getBasetenEmbeddingUrl();
    const apiKey = config.apiKey ?? Config.getBasetenApiKey();
    this.client = new PerformanceClient(url, apiKey);
    this.config = config;
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    return this.client.embed(
      texts,
      this.config.model,
      this.config.encodingFormat,
      this.config.dimensions,
      this.config.userIdentifier,
      this.config.maxConcurrentRequests,
      this.config.batchSize,
      this.config.timeoutInSeconds
    );
  }
}
