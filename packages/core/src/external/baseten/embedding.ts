import { PerformanceClient } from "@basetenlabs/performance-client";
import { Config } from "../../util/config";
import { EmbeddingConfig, EmbeddingResponse, EmbeddingEncoding } from "./types";
import { getBatchSize, getMaxConcurrentRequests, getTimeoutSeconds } from "./utils";

export class EmbeddingClient {
  private client: PerformanceClient;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    const url = config.url ?? Config.getBasetenEmbeddingUrl();
    const apiKey = config.apiKey ?? Config.getBasetenApiKey();
    this.client = new PerformanceClient(url, apiKey);
    this.config = config;
  }

  async createEmbeddings<E extends EmbeddingEncoding = "float">(
    texts: string[]
  ): Promise<EmbeddingResponse<E>> {
    const batchSize = getBatchSize(this.config);
    const maxConcurrentRequests = getMaxConcurrentRequests(this.config);
    const timeoutSeconds = getTimeoutSeconds(this.config);

    const response: EmbeddingResponse<E> = await this.client.embed(
      texts,
      this.config.model,
      this.config.encodingFormat,
      this.config.dimensions,
      this.config.userIdentifier,
      maxConcurrentRequests,
      batchSize,
      timeoutSeconds
    );

    console.log(response);

    return response;
  }
}
