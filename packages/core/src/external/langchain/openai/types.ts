import type { OpenAI as OpenAIClient } from "openai";
import type {
  ResponseFormatText,
  ResponseFormatJSONObject,
  ResponseFormatJSONSchema,
} from "openai/resources/shared";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import type { z } from "zod";

export declare interface OpenAIBaseInput {
  temperature: number;
  maxTokens?: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  n: number;
  logitBias?: Record<string, number>;
  user?: string;
  streaming: boolean;
  streamUsage?: boolean;

  /**
   * Model name to use for js-tiktoken. It is important to set this to a known
   * value like "gpt-4" or "gpt-4o" so that the correct tokenizer is used.
   * @see node_modules/js-tiktoken/dist/chunk***.cjs
   */
  modelName: string;
  /**
   * The model identifier to use in the request to the OpenAI-compatible API.
   */
  model: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelKwargs?: Record<string, any>;
  stop?: string[];
  stopSequences?: string[];
  timeout?: number;

  /**
   * Alias for `apiKey`
   */
  openAIApiKey?: string;
  /**
   * API key to use for making requests - defaults to the value of `OPENAI_API_KEY` environment variable.
   */
  apiKey?: string;
}

// TODO use OpenAI.Core.RequestOptions when SDK is updated to make it available
export type OpenAICoreRequestOptions<Req extends object = Record<string, unknown>> = {
  path?: string;
  query?: Req | undefined;
  body?: Req | undefined;
  headers?: Record<string, string | null | undefined> | undefined;

  maxRetries?: number;
  stream?: boolean | undefined;
  timeout?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  httpAgent?: any;
  signal?: AbortSignal | undefined | null;
  idempotencyKey?: string;
};

export interface OpenAICallOptions extends BaseLanguageModelCallOptions {
  options?: OpenAICoreRequestOptions;
}

export declare interface OpenAIInput extends OpenAIBaseInput {
  bestOf?: number;
  batchSize: number;
}

export interface OpenAIChatInput extends OpenAIBaseInput {
  logprobs?: boolean;
  topLogprobs?: number;
  prefixMessages?: OpenAIClient.Chat.ChatCompletionMessageParam[];
  __includeRawResponse?: boolean;
  supportsStrictToolCalling?: boolean;
  modalities?: Array<OpenAIClient.Chat.ChatCompletionModality>;
  audio?: OpenAIClient.Chat.ChatCompletionAudioParam;
}

type ChatOpenAIResponseFormatJSONSchema = Omit<ResponseFormatJSONSchema, "json_schema"> & {
  json_schema: Omit<ResponseFormatJSONSchema["json_schema"], "schema"> & {
    /**
     * The schema for the response format, described as a JSON Schema object
     * or a Zod object.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: Record<string, any> | z.ZodObject<any, any, any, any>;
  };
};

export type ChatOpenAIResponseFormat =
  | ResponseFormatText
  | ResponseFormatJSONObject
  | ChatOpenAIResponseFormatJSONSchema;
