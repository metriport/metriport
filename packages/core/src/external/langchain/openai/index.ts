import { type ClientOptions, OpenAI as OpenAIClient } from "openai";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  FunctionMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
  ToolMessage,
  ToolMessageChunk,
  OpenAIToolCall,
  isAIMessage,
  UsageMetadata,
  BaseMessageFields,
} from "@langchain/core/messages";
import { type ChatGeneration, ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import {
  BaseChatModel,
  BindToolsInput,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  isOpenAITool,
  type BaseFunctionCallOptions,
  type BaseLanguageModelInput,
  type FunctionDefinition,
  type StructuredOutputMethodOptions,
  type StructuredOutputMethodParams,
} from "@langchain/core/language_models/base";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import { z } from "zod";
import { Runnable, RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import {
  JsonOutputParser,
  StructuredOutputParser,
  type BaseLLMOutputParser,
} from "@langchain/core/output_parsers";
import {
  JsonOutputKeyToolsParser,
  convertLangChainToolCallToOpenAI,
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ToolCallChunk } from "@langchain/core/messages/tool";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ResponseFormatText,
  ResponseFormatJSONObject,
  ResponseFormatJSONSchema,
} from "openai/resources/shared";
import type {
  OpenAICallOptions,
  OpenAIChatInput,
  OpenAICoreRequestOptions,
  ChatOpenAIResponseFormat,
} from "./types";
import { OpenAIToolChoice, formatToOpenAIToolChoice, wrapOpenAIClientError } from "./utils/openai";
import { FunctionDef, formatFunctionDefinitions } from "./utils/openai-format";
import { _convertToOpenAITool } from "./utils/tools";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";

export type { OpenAICallOptions, OpenAIChatInput };

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

interface OpenAILLMOutput {
  tokenUsage: TokenUsage;
}

// TODO import from SDK when available
type OpenAIRoleEnum = "system" | "developer" | "assistant" | "user" | "function" | "tool";

type OpenAICompletionParam = OpenAIClient.Chat.Completions.ChatCompletionMessageParam;
type OpenAIFnDef = OpenAIClient.Chat.ChatCompletionCreateParams.Function;
type OpenAIFnCallOption = OpenAIClient.Chat.ChatCompletionFunctionCallOption;

function extractGenericMessageCustomRole(message: ChatMessage) {
  if (
    message.role !== "system" &&
    message.role !== "developer" &&
    message.role !== "assistant" &&
    message.role !== "user" &&
    message.role !== "function" &&
    message.role !== "tool"
  ) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as OpenAIRoleEnum;
}

export function messageToOpenAIRole(message: BaseMessage): OpenAIRoleEnum {
  const type = message._getType();
  switch (type) {
    case "system":
      return "system";
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "function":
      return "function";
    case "tool":
      return "tool";
    case "generic": {
      if (!ChatMessage.isInstance(message)) throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

// Used in LangSmith, export is important here
export function _convertMessagesToOpenAIParams(
  messages: BaseMessage[],
  model?: string
): OpenAICompletionParam[] {
  // TODO: Function messages do not support array content, fix cast
  return messages.flatMap(message => {
    let role = messageToOpenAIRole(message);
    if (role === "system" && model?.startsWith("o1")) {
      role = "developer";
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completionParam: Record<string, any> = {
      role,
      content: message.content,
    };
    if (message.name != null) {
      completionParam.name = message.name;
    }
    if (message.additional_kwargs.function_call != null) {
      completionParam.function_call = message.additional_kwargs.function_call;
      completionParam.content = null;
    }
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      completionParam.tool_calls = message.tool_calls.map(convertLangChainToolCallToOpenAI);
      completionParam.content = null;
    } else {
      if (message.additional_kwargs.tool_calls != null) {
        completionParam.tool_calls = message.additional_kwargs.tool_calls;
      }
      if ((message as ToolMessage).tool_call_id != null) {
        completionParam.tool_call_id = (message as ToolMessage).tool_call_id;
      }
    }

    if (
      message.additional_kwargs.audio &&
      typeof message.additional_kwargs.audio === "object" &&
      "id" in message.additional_kwargs.audio
    ) {
      const audioMessage = {
        role: "assistant",
        audio: {
          id: message.additional_kwargs.audio.id,
        },
      };
      return [completionParam, audioMessage] as OpenAICompletionParam[];
    }

    return completionParam as OpenAICompletionParam;
  });
}

type ChatOpenAIToolType = BindToolsInput | OpenAIClient.ChatCompletionTool;

function _convertChatOpenAIToolTypeToOpenAITool(
  tool: ChatOpenAIToolType,
  fields?: {
    strict?: boolean;
  }
): OpenAIClient.ChatCompletionTool {
  if (isOpenAITool(tool)) {
    if (fields?.strict !== undefined) {
      return {
        ...tool,
        function: {
          ...tool.function,
          strict: fields.strict,
        },
      };
    }

    return tool;
  }
  return _convertToOpenAITool(tool, fields);
}

// TODO: Use the base structured output options param in next breaking release.
export interface ChatOpenAIStructuredOutputMethodOptions<IncludeRaw extends boolean>
  extends StructuredOutputMethodOptions<IncludeRaw> {
  strict?: boolean;
}

export interface ChatOpenAICallOptions extends OpenAICallOptions, BaseFunctionCallOptions {
  tools?: ChatOpenAIToolType[];
  tool_choice?: OpenAIToolChoice;
  promptIndex?: number;
  response_format?: ChatOpenAIResponseFormat;
  seed?: number;
  stream_options?: {
    include_usage: boolean;
  };

  parallel_tool_calls?: boolean;
  strict?: boolean;
  modalities?: Array<OpenAIClient.Chat.ChatCompletionModality>;
  audio?: OpenAIClient.Chat.ChatCompletionAudioParam;
  prediction?: OpenAIClient.ChatCompletionPredictionContent;
}

export interface ChatOpenAIFields extends Partial<OpenAIChatInput>, BaseChatModelParams {
  configuration?: ClientOptions;
}

export class ChatOpenAI<CallOptions extends ChatOpenAICallOptions = ChatOpenAICallOptions>
  extends BaseChatModel<CallOptions, AIMessageChunk>
  implements Partial<OpenAIChatInput>
{
  static override lc_name() {
    return "ChatOpenAI";
  }

  override get callKeys() {
    return [
      ...super.callKeys,
      "options",
      "function_call",
      "functions",
      "tools",
      "tool_choice",
      "promptIndex",
      "response_format",
      "seed",
      "reasoning_effort",
    ];
  }

  override lc_serializable = true;

  override get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
      apiKey: "OPENAI_API_KEY",
      organization: "OPENAI_ORGANIZATION",
    };
  }

  override get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
      openAIApiKey: "openai_api_key",
      apiKey: "openai_api_key",
    };
  }

  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  n = 1;
  logitBias?: Record<string, number>;
  modelName?: string;
  model = "gpt-3.5-turbo";
  modelKwargs: NonNullable<OpenAIChatInput["modelKwargs"]>;
  stop?: string[];
  stopSequences?: string[];
  user?: string;
  timeout?: number;
  streaming = false;
  streamUsage = true;
  maxTokens?: number;
  logprobs?: boolean;
  topLogprobs?: number;
  openAIApiKey?: string;
  apiKey?: string;
  __includeRawResponse?: boolean;
  protected client?: OpenAIClient;
  protected clientConfig: ClientOptions;
  supportsStrictToolCalling?: boolean;
  audio?: OpenAIClient.Chat.ChatCompletionAudioParam;
  modalities?: Array<OpenAIClient.Chat.ChatCompletionModality>;

  constructor(fields?: ChatOpenAIFields) {
    super(fields ?? {});

    this.openAIApiKey =
      fields?.apiKey ??
      fields?.openAIApiKey ??
      fields?.configuration?.apiKey ??
      getEnvVarOrFail("OPENAI_API_KEY");
    this.apiKey = this.openAIApiKey;

    this.model = fields?.model ?? this.model;
    this.modelName = fields?.modelName ?? this.modelName ?? this.model;
    this.modelKwargs = fields?.modelKwargs ?? {};
    if (fields?.timeout != null) {
      this.timeout = fields.timeout;
    }

    if (fields?.temperature != null) {
      this.temperature = fields.temperature;
    }
    if (fields?.topP != null) {
      this.topP = fields.topP;
    }
    if (fields?.frequencyPenalty != null) {
      this.frequencyPenalty = fields.frequencyPenalty;
    }
    if (fields?.presencePenalty != null) {
      this.presencePenalty = fields?.presencePenalty;
    }
    if (fields?.maxTokens != null) {
      this.maxTokens = fields.maxTokens;
    }
    if (fields?.logprobs != null) {
      this.logprobs = fields.logprobs;
    }
    if (fields?.topLogprobs != null) {
      this.topLogprobs = fields.topLogprobs;
    }
    if (fields?.n != null) {
      this.n = fields.n;
    }
    if (fields?.logitBias != null) {
      this.logitBias = fields.logitBias;
    }
    if (fields?.stopSequences != null) {
      this.stopSequences = fields.stopSequences;
    }
    if (fields?.stop != null) {
      this.stop = fields.stop;
    }
    if (fields?.user != null) {
      this.user = fields.user;
    }
    if (fields?.__includeRawResponse != null) {
      this.__includeRawResponse = fields.__includeRawResponse;
    }
    if (fields?.audio != null) {
      this.audio = fields.audio;
    }
    if (fields?.modalities != null) {
      this.modalities = fields.modalities;
    }

    this.streaming = fields?.streaming ?? false;
    this.streamUsage = fields?.streamUsage ?? this.streamUsage;
    if (this.model === "o1") {
      this.streaming = false;
    }

    this.clientConfig = {
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
      ...fields?.configuration,
    };

    // If `supportsStrictToolCalling` is explicitly set, use that value.
    // Else leave undefined so it's not passed to OpenAI.
    if (fields?.supportsStrictToolCalling !== undefined) {
      this.supportsStrictToolCalling = fields.supportsStrictToolCalling;
    }
  }

  override getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "openai",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ...(params.temperature != null ? { ls_temperature: params.temperature } : {}),
      ...(params.max_tokens != null ? { ls_max_tokens: params.max_tokens } : {}),
      ...(options.stop != null ? { ls_stop: options.stop } : {}),
    };
  }

  override bindTools(
    tools: ChatOpenAIToolType[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    let strict: boolean | undefined;
    if (kwargs?.strict !== undefined) {
      strict = kwargs.strict;
    } else if (this.supportsStrictToolCalling !== undefined) {
      strict = this.supportsStrictToolCalling;
    }
    return this.bind({
      tools: tools.map(tool =>
        _convertChatOpenAIToolTypeToOpenAITool(tool, strict != null ? { strict } : undefined)
      ),
      ...kwargs,
    } as Partial<CallOptions>);
  }

  private createResponseFormat(
    resFormat?: CallOptions["response_format"]
  ): ResponseFormatText | ResponseFormatJSONObject | ResponseFormatJSONSchema | undefined {
    if (
      resFormat &&
      resFormat.type === "json_schema" &&
      resFormat.json_schema.schema &&
      isZodSchema(resFormat.json_schema.schema)
    ) {
      return zodResponseFormat(resFormat.json_schema.schema, resFormat.json_schema.name, {
        description: resFormat.json_schema.description ?? "",
      });
    }
    return resFormat as
      | ResponseFormatText
      | ResponseFormatJSONObject
      | ResponseFormatJSONSchema
      | undefined;
  }

  /**
   * Get the parameters used to invoke the model
   */
  override invocationParams(
    options?: this["ParsedCallOptions"],
    extra?: {
      streaming?: boolean;
    }
  ): Omit<OpenAIClient.Chat.ChatCompletionCreateParams, "messages"> {
    let strict: boolean | undefined;
    if (options?.strict !== undefined) {
      strict = options.strict;
    } else if (this.supportsStrictToolCalling !== undefined) {
      strict = this.supportsStrictToolCalling;
    }

    let streamOptionsConfig = {};
    if (options?.stream_options !== undefined) {
      streamOptionsConfig = { stream_options: options.stream_options };
    } else if (this.streamUsage && (this.streaming || extra?.streaming)) {
      streamOptionsConfig = { stream_options: { include_usage: true } };
    }

    const responseFormat = this.createResponseFormat(options?.response_format);
    const toolChoice =
      options?.tool_choice != null ? formatToOpenAIToolChoice(options?.tool_choice) : undefined;
    const modalities = options?.modalities ?? this.modalities;
    const audio = options?.audio ?? this.audio;
    const maxTokens = this.maxTokens === -1 ? undefined : this.maxTokens;

    const params: Omit<OpenAIClient.Chat.ChatCompletionCreateParams, "messages"> = {
      model: this.model,
      ...(this.temperature != null ? { temperature: this.temperature } : {}),
      ...(this.topP != null ? { top_p: this.topP } : {}),
      ...(this.frequencyPenalty != null ? { frequency_penalty: this.frequencyPenalty } : {}),
      ...(this.presencePenalty != null ? { presence_penalty: this.presencePenalty } : {}),
      ...(maxTokens != null ? { max_tokens: maxTokens } : {}),
      ...(this.logprobs != null ? { logprobs: this.logprobs } : {}),
      ...(this.topLogprobs != null ? { top_logprobs: this.topLogprobs } : {}),
      ...(this.n != null ? { n: this.n } : {}),
      ...(this.logitBias != null ? { logit_bias: this.logitBias } : {}),
      ...(options?.stop != null ? { stop: options.stop } : {}),
      ...(this.user != null ? { user: this.user } : {}),
      // if include_usage is set or streamUsage then stream must be set to true.
      ...(this.streaming ? { stream: true } : {}),
      ...(options?.functions != null ? { functions: options.functions } : {}),
      ...(options?.tools?.length
        ? {
            tools: options.tools.map(tool =>
              _convertChatOpenAIToolTypeToOpenAITool(tool, strict != null ? { strict } : undefined)
            ),
          }
        : {}),
      ...(toolChoice != null ? { tool_choice: toolChoice } : {}),
      ...(responseFormat != null ? { response_format: responseFormat } : {}),
      ...(options?.seed != null ? { seed: options.seed } : {}),
      ...streamOptionsConfig,
      ...(options?.parallel_tool_calls != null
        ? { parallel_tool_calls: options.parallel_tool_calls }
        : {}),
      ...(audio != null ? { audio: audio } : {}),
      ...(modalities != null ? { modalities: modalities } : {}),
      ...this.modelKwargs,
    };
    if (options?.prediction !== undefined) {
      params.prediction = options.prediction;
    }
    return params;
  }

  protected _convertOpenAIChatCompletionMessageToBaseMessage(
    message: OpenAIClient.Chat.Completions.ChatCompletionMessage,
    rawResponse: OpenAIClient.Chat.Completions.ChatCompletion
  ): BaseMessage {
    const rawToolCalls: OpenAIToolCall[] | undefined = message.tool_calls as
      | OpenAIToolCall[]
      | undefined;
    switch (message.role) {
      case "assistant": {
        const toolCalls = [];
        const invalidToolCalls = [];
        for (const rawToolCall of rawToolCalls ?? []) {
          try {
            toolCalls.push(parseToolCall(rawToolCall, { returnId: true }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            invalidToolCalls.push(makeInvalidToolCall(rawToolCall, e.message));
          }
        }
        const additional_kwargs: Record<string, unknown> = {
          function_call: message.function_call,
          tool_calls: rawToolCalls,
        };
        if (this.__includeRawResponse !== undefined) {
          additional_kwargs.__raw_response = rawResponse;
        }
        const response_metadata: Record<string, unknown> | undefined = {
          model_name: rawResponse.model,
          ...(rawResponse.system_fingerprint
            ? {
                usage: { ...rawResponse.usage },
                system_fingerprint: rawResponse.system_fingerprint,
              }
            : {}),
        };

        if (message.audio) {
          additional_kwargs.audio = message.audio;
        }

        return new AIMessage({
          content: message.content || "",
          tool_calls: toolCalls,
          invalid_tool_calls: invalidToolCalls,
          additional_kwargs,
          response_metadata,
          id: rawResponse.id,
        });
      }
      default:
        return new ChatMessage(message.content || "", message.role ?? "unknown");
    }
  }

  protected _convertOpenAIDeltaToBaseMessageChunk(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delta: Record<string, any>,
    rawResponse: OpenAIClient.Chat.Completions.ChatCompletionChunk,
    defaultRole?: OpenAIRoleEnum
  ) {
    const role = delta.role ?? defaultRole;
    const content = delta.content ?? "";
    let additional_kwargs: Record<string, unknown>;
    if (delta.function_call) {
      additional_kwargs = {
        function_call: delta.function_call,
      };
    } else if (delta.tool_calls) {
      additional_kwargs = {
        tool_calls: delta.tool_calls,
      };
    } else {
      additional_kwargs = {};
    }
    if (this.__includeRawResponse) {
      additional_kwargs.__raw_response = rawResponse;
    }

    if (delta.audio) {
      additional_kwargs.audio = {
        ...delta.audio,
        index: rawResponse.choices[0]?.index,
      };
    }

    const response_metadata = { usage: { ...rawResponse.usage } };
    if (role === "user") {
      return new HumanMessageChunk({ content, response_metadata });
    } else if (role === "assistant") {
      const toolCallChunks: ToolCallChunk[] = [];
      if (Array.isArray(delta.tool_calls)) {
        for (const rawToolCall of delta.tool_calls) {
          toolCallChunks.push({
            name: rawToolCall.function?.name,
            args: rawToolCall.function?.arguments,
            id: rawToolCall.id,
            index: rawToolCall.index,
            type: "tool_call_chunk",
          });
        }
      }
      return new AIMessageChunk({
        content,
        tool_call_chunks: toolCallChunks,
        additional_kwargs,
        id: rawResponse.id,
        response_metadata,
      });
    } else if (role === "system") {
      return new SystemMessageChunk({ content, response_metadata });
    } else if (role === "developer") {
      return new SystemMessageChunk({
        content,
        response_metadata,
        additional_kwargs: {
          __openai_role__: "developer",
        },
      });
    } else if (role === "function") {
      return new FunctionMessageChunk({
        content,
        additional_kwargs,
        name: delta.name,
        response_metadata,
      });
    } else if (role === "tool") {
      return new ToolMessageChunk({
        content,
        additional_kwargs,
        tool_call_id: delta.tool_call_id,
        response_metadata,
      });
    } else {
      return new ChatMessageChunk({ content, role, response_metadata });
    }
  }

  /** @ignore */
  override _identifyingParams(): Omit<OpenAIClient.Chat.ChatCompletionCreateParams, "messages"> & {
    model_name: string;
  } & ClientOptions {
    return {
      model_name: this.model,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const messagesMapped: OpenAICompletionParam[] = _convertMessagesToOpenAIParams(
      messages,
      this.model
    );
    const params = {
      ...this.invocationParams(options, {
        streaming: true,
      }),
      messages: messagesMapped,
      stream: true as const,
    };
    let defaultRole: OpenAIRoleEnum | undefined;

    const streamIterable = await this.completionWithRetry(
      params,
      options as OpenAICoreRequestOptions
    );
    let usage: OpenAIClient.Completions.CompletionUsage | undefined;
    for await (const data of streamIterable) {
      const choice = data?.choices?.[0];
      if (data.usage) {
        usage = data.usage;
      }
      if (!choice) {
        continue;
      }

      const { delta } = choice;
      if (!delta) {
        continue;
      }
      const chunk = this._convertOpenAIDeltaToBaseMessageChunk(delta, data, defaultRole);
      defaultRole = delta.role ?? defaultRole;
      const newTokenIndices = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      };
      if (typeof chunk.content !== "string") {
        console.log(
          "[WARNING]: Received non-string content from OpenAI. This is currently not supported."
        );
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generationInfo: Record<string, any> = { ...newTokenIndices };
      if (choice.finish_reason != null) {
        generationInfo.finish_reason = choice.finish_reason;
        // Only include system fingerprint in the last chunk for now
        // to avoid concatenation issues
        generationInfo.system_fingerprint = data.system_fingerprint;
        generationInfo.model_name = data.model;
      }
      if (this.logprobs) {
        generationInfo.logprobs = choice.logprobs;
      }
      const generationChunk = new ChatGenerationChunk({
        message: chunk,
        text: chunk.content,
        generationInfo,
      });
      yield generationChunk;
      await runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
        newTokenIndices,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
    if (usage) {
      const inputTokenDetails = {
        ...(usage.prompt_tokens_details?.audio_tokens !== null
          ? {
              audio: usage.prompt_tokens_details?.audio_tokens ?? 0,
            }
          : {}),
        ...(usage.prompt_tokens_details?.cached_tokens !== null
          ? {
              cache_read: usage.prompt_tokens_details?.cached_tokens ?? 0,
            }
          : {}),
      };
      const outputTokenDetails = {
        ...(usage.completion_tokens_details?.audio_tokens !== null
          ? {
              audio: usage.completion_tokens_details?.audio_tokens ?? 0,
            }
          : {}),
        ...(usage.completion_tokens_details?.reasoning_tokens !== null
          ? {
              reasoning: usage.completion_tokens_details?.reasoning_tokens ?? 0,
            }
          : {}),
      };
      const generationChunk = new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: "",
          response_metadata: {
            usage: { ...usage },
          },
          usage_metadata: {
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            ...(Object.keys(inputTokenDetails).length > 0 && {
              input_token_details: inputTokenDetails,
            }),
            ...(Object.keys(outputTokenDetails).length > 0 && {
              output_token_details: outputTokenDetails,
            }),
          },
        }),
        text: "",
      });
      yield generationChunk;
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  identifyingParams() {
    return this._identifyingParams();
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const usageMetadata = {} as UsageMetadata;
    const params = this.invocationParams(options);
    const messagesMapped: OpenAICompletionParam[] = _convertMessagesToOpenAIParams(
      messages,
      this.model
    );

    if (params.stream) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
        chunk.message.response_metadata = {
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        };
        const index = (chunk.generationInfo as NewTokenIndices)?.completion ?? 0;
        const chunkAtIndex = finalChunks[index];
        if (chunkAtIndex === undefined) {
          finalChunks[index] = chunk;
        } else {
          finalChunks[index] = chunkAtIndex.concat(chunk);
        }
      }
      const generations = Object.entries(finalChunks)
        .sort(([aKey], [bKey]) => parseInt(aKey, 10) - parseInt(bKey, 10))
        .map(([, value]) => value);

      const { functions, function_call } = this.invocationParams(options);

      // OpenAI does not support token usage report under stream mode,
      // fallback to estimation.

      const promptTokenUsage = await this.getEstimatedTokenCountFromPrompt(
        messages,
        functions,
        function_call
      );
      const completionTokenUsage = await this.getNumTokensFromGenerations(generations);

      usageMetadata.input_tokens = promptTokenUsage;
      usageMetadata.output_tokens = completionTokenUsage;
      usageMetadata.total_tokens = promptTokenUsage + completionTokenUsage;
      return {
        generations,
        llmOutput: {
          estimatedTokenUsage: {
            promptTokens: usageMetadata.input_tokens,
            completionTokens: usageMetadata.output_tokens,
            totalTokens: usageMetadata.total_tokens,
          },
        },
      };
    } else {
      let data;
      if (options.response_format && options.response_format.type === "json_schema") {
        data = await this.betaParsedCompletionWithRetry(
          {
            ...params,
            stream: false,
            messages: messagesMapped,
          },
          {
            signal: options?.signal,
            ...options?.options,
          }
        );
      } else {
        data = await this.completionWithRetry(
          {
            ...params,
            stream: false,
            messages: messagesMapped,
          },
          {
            signal: options?.signal,
            ...options?.options,
          }
        );
      }

      const {
        completion_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
        prompt_tokens_details: promptTokensDetails,
        completion_tokens_details: completionTokensDetails,
      } = data?.usage ?? {};

      if (completionTokens) {
        usageMetadata.output_tokens = (usageMetadata.output_tokens ?? 0) + completionTokens;
      }

      if (promptTokens) {
        usageMetadata.input_tokens = (usageMetadata.input_tokens ?? 0) + promptTokens;
      }

      if (totalTokens) {
        usageMetadata.total_tokens = (usageMetadata.total_tokens ?? 0) + totalTokens;
      }

      if (
        promptTokensDetails?.audio_tokens !== null ||
        promptTokensDetails?.cached_tokens !== null
      ) {
        usageMetadata.input_token_details = {
          ...(promptTokensDetails?.audio_tokens !== null && {
            audio: promptTokensDetails?.audio_tokens ?? 0,
          }),
          ...(promptTokensDetails?.cached_tokens !== null && {
            cache_read: promptTokensDetails?.cached_tokens ?? 0,
          }),
        };
      }

      if (
        completionTokensDetails?.audio_tokens !== null ||
        completionTokensDetails?.reasoning_tokens !== null
      ) {
        usageMetadata.output_token_details = {
          ...(completionTokensDetails?.audio_tokens !== null
            ? {
                audio: completionTokensDetails?.audio_tokens ?? 0,
              }
            : {}),
          ...(completionTokensDetails?.reasoning_tokens !== null
            ? {
                reasoning: completionTokensDetails?.reasoning_tokens ?? 0,
              }
            : {}),
        };
      }

      const generations: ChatGeneration[] = [];
      for (const part of data?.choices ?? []) {
        const text = part.message?.content ?? "";
        const generation: ChatGeneration = {
          text,
          message: this._convertOpenAIChatCompletionMessageToBaseMessage(
            part.message ?? { role: "assistant" },
            data
          ),
        };
        generation.generationInfo = {
          ...(part.finish_reason ? { finish_reason: part.finish_reason } : {}),
          ...(part.logprobs ? { logprobs: part.logprobs } : {}),
        };
        if (isAIMessage(generation.message)) {
          generation.message.usage_metadata = usageMetadata;
        }
        // Fields are not serialized unless passed to the constructor
        // Doing this ensures all fields on the message are serialized
        generation.message = new AIMessage(
          Object.fromEntries(
            Object.entries(generation.message).filter(([key]) => !key.startsWith("lc_"))
          ) as BaseMessageFields
        );
        generations.push(generation);
      }
      return {
        generations,
        llmOutput: {
          tokenUsage: {
            promptTokens: usageMetadata.input_tokens,
            completionTokens: usageMetadata.output_tokens,
            totalTokens: usageMetadata.total_tokens,
          },
        },
      };
    }
  }

  /**
   * Estimate the number of tokens a prompt will use.
   * Modified from: https://github.com/hmarr/openai-chat-tokens/blob/main/src/index.ts
   */
  private async getEstimatedTokenCountFromPrompt(
    messages: BaseMessage[],
    functions?: OpenAIFnDef[],
    function_call?: "none" | "auto" | OpenAIFnCallOption
  ): Promise<number> {
    // It appears that if functions are present, the first system message is padded with a trailing newline. This
    // was inferred by trying lots of combinations of messages and functions and seeing what the token counts were.
    let tokens = (await this.getNumTokensFromMessages(messages)).totalCount;

    // If there are functions, add the function definitions as they count towards token usage
    if (functions && function_call !== "auto") {
      const promptDefinitions = formatFunctionDefinitions(functions as unknown as FunctionDef[]);
      tokens += await this.getNumTokens(promptDefinitions);
      tokens += 9; // Add nine per completion
    }

    // If there's a system message _and_ functions are present, subtract four tokens. I assume this is because
    // functions typically add a system message, but reuse the first one if it's already there. This offsets
    // the extra 9 tokens added by the function definitions.
    if (functions && messages.find(m => m._getType() === "system")) {
      tokens -= 4;
    }

    // If function_call is 'none', add one token.
    // If it's a FunctionCall object, add 4 + the number of tokens in the function name.
    // If it's undefined or 'auto', don't add anything.
    if (function_call === "none") {
      tokens += 1;
    } else if (typeof function_call === "object") {
      tokens += (await this.getNumTokens(function_call.name)) + 4;
    }

    return tokens;
  }

  /**
   * Estimate the number of tokens an array of generations have used.
   */
  private async getNumTokensFromGenerations(generations: ChatGeneration[]) {
    const generationUsages = await Promise.all(
      generations.map(async generation => {
        if (generation.message.additional_kwargs?.function_call) {
          return (await this.getNumTokensFromMessages([generation.message])).countPerMessage[0];
        } else {
          return await this.getNumTokens(generation.message.content);
        }
      })
    );

    return generationUsages.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
  }

  async getNumTokensFromMessages(messages: BaseMessage[]) {
    let totalCount = 0;
    let tokensPerMessage = 0;
    let tokensPerName = 0;

    // From: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
    if (this.model === "gpt-3.5-turbo-0301") {
      tokensPerMessage = 4;
      tokensPerName = -1;
    } else {
      tokensPerMessage = 3;
      tokensPerName = 1;
    }

    const countPerMessage = await Promise.all(
      messages.map(async message => {
        const textCount = await this.getNumTokens(message.content);
        const roleCount = await this.getNumTokens(messageToOpenAIRole(message));
        const nameCount =
          message.name !== undefined ? tokensPerName + (await this.getNumTokens(message.name)) : 0;
        let count = textCount + tokensPerMessage + roleCount + nameCount;

        // From: https://github.com/hmarr/openai-chat-tokens/blob/main/src/index.ts messageTokenEstimate
        const openAIMessage = message;
        if (openAIMessage._getType() === "function") {
          count -= 2;
        }
        if (openAIMessage.additional_kwargs?.function_call) {
          count += 3;
        }
        if (openAIMessage?.additional_kwargs.function_call?.name) {
          count += await this.getNumTokens(openAIMessage.additional_kwargs.function_call?.name);
        }
        if (openAIMessage.additional_kwargs.function_call?.arguments) {
          try {
            count += await this.getNumTokens(
              // Remove newlines and spaces
              JSON.stringify(JSON.parse(openAIMessage.additional_kwargs.function_call?.arguments))
            );
          } catch (error) {
            console.error(
              "Error parsing function arguments",
              error,
              JSON.stringify(openAIMessage.additional_kwargs.function_call)
            );
            count += await this.getNumTokens(
              openAIMessage.additional_kwargs.function_call?.arguments
            );
          }
        }

        totalCount += count;
        return count;
      })
    );

    totalCount += 3; // every reply is primed with <|start|>assistant<|message|>

    return { totalCount, countPerMessage };
  }

  /**
   * Calls the OpenAI API with retry logic in case of failures.
   * @param request The request to send to the OpenAI API.
   * @param options Optional configuration for the API call.
   * @returns The response from the OpenAI API.
   */
  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>>;

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<OpenAIClient.Chat.Completions.ChatCompletion>;

  async completionWithRetry(
    request:
      | OpenAIClient.Chat.ChatCompletionCreateParamsStreaming
      | OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<
    | AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>
    | OpenAIClient.Chat.Completions.ChatCompletion
  > {
    const requestOptions = this._getClientOptions(options);
    return this.caller.call(async () => {
      try {
        if (!this.client) throw new Error("No client configured");
        const res = await this.client.chat.completions.create(request, requestOptions);
        return res;
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  /**
   * Call the beta chat completions parse endpoint. This should only be called if
   * response_format is set to "json_object".
   * @param {OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming} request
   * @param {OpenAICoreRequestOptions | undefined} options
   */
  async betaParsedCompletionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
    // Avoid relying importing a beta type with no official entrypoint
  ): Promise<ReturnType<OpenAIClient["beta"]["chat"]["completions"]["parse"]>> {
    const requestOptions = this._getClientOptions(options);
    return this.caller.call(async () => {
      try {
        if (!this.client) throw new Error("No client configured");
        const res = await this.client.beta.chat.completions.parse(request, requestOptions);
        return res;
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  protected _getClientOptions(options: OpenAICoreRequestOptions | undefined) {
    if (!this.client) {
      const baseURL = this.clientConfig.baseURL;
      const params = {
        ...this.clientConfig,
        ...(baseURL != null ? { baseURL } : {}),
        ...(this.timeout != null ? { timeout: this.timeout } : {}),
        maxRetries: 0,
      };

      this.client = new OpenAIClient(params);
    }
    const requestOptions = {
      ...this.clientConfig,
      ...options,
    } as OpenAICoreRequestOptions;
    return requestOptions;
  }

  override _llmType() {
    return "openai";
  }

  /** @ignore */
  override _combineLLMOutput(...llmOutputs: OpenAILLMOutput[]): OpenAILLMOutput {
    return llmOutputs.reduce<{
      [key in keyof OpenAILLMOutput]: Required<OpenAILLMOutput[key]>;
    }>(
      (acc, llmOutput) => {
        if (llmOutput && llmOutput.tokenUsage) {
          acc.tokenUsage.completionTokens += llmOutput.tokenUsage.completionTokens ?? 0;
          acc.tokenUsage.promptTokens += llmOutput.tokenUsage.promptTokens ?? 0;
          acc.tokenUsage.totalTokens += llmOutput.tokenUsage.totalTokens ?? 0;
        }
        return acc;
      },
      {
        tokenUsage: {
          completionTokens: 0,
          promptTokens: 0,
          totalTokens: 0,
        },
      }
    );
  }

  override withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: ChatOpenAIStructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  override withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: ChatOpenAIStructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  override withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: ChatOpenAIStructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  override withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: ChatOpenAIStructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schema: z.ZodType<RunOutput> | Record<string, any>;
    let name;
    let method;
    let includeRaw;
    if (isStructuredOutputMethodParams(outputSchema)) {
      schema = outputSchema.schema;
      name = outputSchema.name;
      method = outputSchema.method;
      includeRaw = outputSchema.includeRaw;
    } else {
      schema = outputSchema;
      name = config?.name;
      method = config?.method;
      includeRaw = config?.includeRaw;
    }
    let llm: Runnable<BaseLanguageModelInput>;
    let outputParser: BaseLLMOutputParser<RunOutput>;

    if (config?.strict !== undefined && method === "jsonMode") {
      throw new Error("Argument `strict` is only supported for `method` = 'function_calling'");
    }

    if (
      !this.model.startsWith("gpt-3") &&
      !this.model.startsWith("gpt-4-") &&
      this.model !== "gpt-4"
    ) {
      if (method === undefined) {
        method = "jsonSchema";
      }
    } else if (method === "jsonSchema") {
      console.warn(
        `[WARNING]: JSON Schema is not supported for model "${this.model}". Falling back to tool calling.`
      );
    }

    if (method === "jsonMode") {
      llm = this.bind({
        response_format: { type: "json_object" },
      } as Partial<CallOptions>);
      if (isZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else if (method === "jsonSchema") {
      llm = this.bind({
        response_format: {
          type: "json_schema",
          json_schema: {
            name: name ?? "extract",
            description: schema.description,
            schema,
            strict: config?.strict,
          },
        },
      } as Partial<CallOptions>);
      if (isZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else {
      let functionName = name ?? "extract";
      // Is function calling
      if (isZodSchema(schema)) {
        const asJsonSchema = zodToJsonSchema(schema);
        llm = this.bind({
          tools: [
            {
              type: "function" as const,
              function: {
                name: functionName,
                description: asJsonSchema.description,
                parameters: asJsonSchema,
              },
            },
          ],
          tool_choice: {
            type: "function" as const,
            function: {
              name: functionName,
            },
          },
          // Do not pass `strict` argument to OpenAI if `config.strict` is undefined
          ...(config?.strict !== undefined ? { strict: config.strict } : {}),
        } as Partial<CallOptions>);
        outputParser = new JsonOutputKeyToolsParser({
          returnSingle: true,
          keyName: functionName,
          zodSchema: schema,
        });
      } else {
        let openAIFunctionDefinition: FunctionDefinition;
        if (
          typeof schema.name === "string" &&
          typeof schema.parameters === "object" &&
          schema.parameters != null
        ) {
          openAIFunctionDefinition = schema as FunctionDefinition;
          functionName = schema.name;
        } else {
          functionName = schema.title ?? functionName;
          openAIFunctionDefinition = {
            name: functionName,
            description: schema.description ?? "",
            parameters: schema,
          };
        }
        llm = this.bind({
          tools: [
            {
              type: "function" as const,
              function: openAIFunctionDefinition,
            },
          ],
          tool_choice: {
            type: "function" as const,
            function: {
              name: functionName,
            },
          },
          // Do not pass `strict` argument to OpenAI if `config.strict` is undefined
          ...(config?.strict !== undefined ? { strict: config.strict } : {}),
        } as Partial<CallOptions>);
        outputParser = new JsonOutputKeyToolsParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
      }
    }

    if (!includeRaw) {
      return llm.pipe(outputParser) as Runnable<BaseLanguageModelInput, RunOutput>;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return RunnableSequence.from<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]);
  }
}

function isZodSchema<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: z.ZodType<RunOutput> | Record<string, any>
): input is z.ZodType<RunOutput> {
  // Check for a characteristic method of Zod schemas
  return typeof (input as z.ZodType<RunOutput>)?.parse === "function";
}

function isStructuredOutputMethodParams(
  x: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): x is StructuredOutputMethodParams<Record<string, any>> {
  return (
    x !== undefined &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (x as StructuredOutputMethodParams<Record<string, any>>).schema === "object"
  );
}
