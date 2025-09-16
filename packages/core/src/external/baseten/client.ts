import { PerformanceClient } from "@basetenlabs/performance-client";
import { Config } from "../../util/config";
import { EmbeddingConfig } from "./types";

class BasetenClient {
  protected client: PerformanceClient;

  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    this.client = new PerformanceClient(url, apiKey);
  }
}

export class BasetenEmbeddingClient extends BasetenClient {
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    super({ url: Config.getBasetenEmbeddingUrl(), apiKey: Config.getBasetenApiKey() });
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
