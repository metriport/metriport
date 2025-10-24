import _ from "lodash";
import { PerformanceClient } from "@basetenlabs/performance-client";
import { Config } from "../../util/config";
import {
  EmbeddingConfig,
  EmbeddingResponse,
  TextWithIndex,
  TextWithEmbedding,
  TextWithIndexAndEmbedding,
} from "./types";
import {
  getBatchSize,
  getMaxConcurrentRequests,
  getTimeoutSeconds,
  createTextWithEmbedding,
  createTextWithIndexAndEmbedding,
} from "./utils";
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

  async batchEmbed(textsToEmbed: string[]): Promise<EmbeddingResponse> {
    const batchSize = getBatchSize(this.config);
    const maxConcurrentRequests = getMaxConcurrentRequests(this.config);
    const timeoutSeconds = getTimeoutSeconds(this.config);

    const response: EmbeddingResponse = await this.client.embed(
      textsToEmbed,
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

  async createTextWithEmbedding(textsToEmbed: string[]): Promise<TextWithEmbedding[]> {
    const response = await this.batchEmbed(textsToEmbed);
    const textWithEmbeddings = response.data.map(data =>
      createTextWithEmbedding(data, textsToEmbed)
    );
    return _.compact(textWithEmbeddings);
  }

  async createTextWithIndexAndEmbedding(
    textsWithIndex: TextWithIndex[]
  ): Promise<TextWithIndexAndEmbedding[]> {
    const response = await this.batchEmbed(textsWithIndex.map(({ text }) => text));
    const textWithIndexAndEmbeddings = response.data.map((data, index) =>
      createTextWithIndexAndEmbedding(data, textsWithIndex, index)
    );
    return _.compact(textWithIndexAndEmbeddings);
  }
}
