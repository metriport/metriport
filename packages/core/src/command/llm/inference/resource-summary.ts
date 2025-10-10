import { initTimer } from "@metriport/shared/common/timer";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { AnthropicAgent } from "../../../external/bedrock/agent/anthropic";
import { getAssistantResponseText } from "../../../external/bedrock/model/anthropic/response";
import {
  getResourceSummaryCollationPrompt,
  getResourceSummaryPrompt,
  systemPrompt,
} from "./prompts";
import { chunkTextForModel, estimateTokenCount } from "./model-chunking";

export type ResourceInference = {
  resourceType: string;
  resourceDisplays: string[];
  customPromptSection: string;
  context: string;
  resourceRowData?: Record<string, unknown>;
};

export type SummaryResult = {
  summary: string | undefined;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  chunksDuration?: number;
  collationDuration?: number;
};

type ChunkResult = {
  summary: string;
  inputTokens?: number;
  outputTokens?: number;
};

export async function summarizeContext({
  resourceType,
  resourceDisplays,
  customPromptSection,
  context,
  resourceRowData,
}: ResourceInference): Promise<SummaryResult> {
  const { log } = out(`summarizeContext`);

  const modelVersion = "claude-sonnet-3.7";
  const { chunks } = chunkTextForModel({ text: context, modelVersion });
  log(
    `Source context length: ${context.length} characters, or about ${estimateTokenCount(
      context
    )} tokens\nSummarizing ${chunks.length} chunks`
  );

  // Track tokens across all calls
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Create all summaries
  const chunksTimer = initTimer();
  const responses = await Promise.all(
    chunks.map(async chunk => {
      const result = await summarizeChunk({
        resourceType,
        resourceDisplays,
        customPromptSection,
        context: chunk,
        ...(resourceRowData ? { resourceRowData } : {}),
      });
      totalInputTokens += result.inputTokens ?? 0;
      totalOutputTokens += result.outputTokens ?? 0;
      return result.summary;
    })
  );
  const chunksDuration = chunksTimer.getElapsedTime();
  log(`Chunks processing duration: ${chunksDuration}ms`);

  // Skip collation if there's only one summary we received - faster answer.
  if (responses.length === 1) {
    return {
      summary: responses[0],
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      chunksDuration,
    };
  }

  responses.forEach(response => {
    log(`Response: ${response}`);
  });

  // Collate summaries
  const collationTimer = initTimer();
  const collationResult = await collateSummaries({
    resourceType,
    resourceDisplays,
    customPromptSection,
    summaries: responses,
    ...(resourceRowData ? { resourceRowData } : {}),
  });
  const collationDuration = collationTimer.getElapsedTime();
  log(`Collation duration: ${collationDuration}ms`);

  return {
    summary: collationResult.summary,
    inputTokens: totalInputTokens + (collationResult.inputTokens ?? 0),
    outputTokens: totalOutputTokens + (collationResult.outputTokens ?? 0),
    chunksDuration,
    collationDuration,
  };
}

export async function summarizeChunk({
  resourceType,
  resourceDisplays,
  customPromptSection,
  context,
  resourceRowData,
}: ResourceInference): Promise<ChunkResult> {
  const agent = new AnthropicAgent({
    version: "claude-sonnet-3.7",
    region: Config.getAWSRegion(),
    systemPrompt,
    maxTokens: 8192,
    temperature: 0,
  });

  const prompt = getResourceSummaryPrompt({
    resourceType,
    resourceDisplays,
    customPromptSection,
    context,
    ...(resourceRowData ? { resourceRowData } : {}),
  });

  agent.addUserMessageText(prompt);
  const response = await agent.continueConversation();

  const message = getAssistantResponseText(response) ?? "";
  const usage = agent.getUsage();

  const result: ChunkResult = {
    summary: message,
  };
  if (usage.input_tokens !== undefined) {
    result.inputTokens = usage.input_tokens;
  }
  if (usage.output_tokens !== undefined) {
    result.outputTokens = usage.output_tokens;
  }
  return result;
}

export async function collateSummaries({
  resourceType,
  resourceDisplays,
  customPromptSection,
  summaries,
  resourceRowData,
}: {
  resourceType: string;
  resourceDisplays: string[];
  customPromptSection: string;
  summaries: string[];
  resourceRowData?: Record<string, unknown>;
}): Promise<ChunkResult> {
  const agent = new AnthropicAgent({
    version: "claude-sonnet-3.7",
    region: Config.getAWSRegion(),
    systemPrompt,
    maxTokens: 8192,
    temperature: 0,
  });

  const prompt = getResourceSummaryCollationPrompt({
    resourceType,
    resourceDisplays,
    customPromptSection,
    responses: summaries,
    ...(resourceRowData ? { resourceRowData } : {}),
  });

  agent.addUserMessageText(prompt);
  const response = await agent.continueConversation();

  const message = getAssistantResponseText(response) ?? "";
  const usage = agent.getUsage();

  const result: ChunkResult = {
    summary: message,
  };
  if (usage.input_tokens !== undefined) {
    result.inputTokens = usage.input_tokens;
  }
  if (usage.output_tokens !== undefined) {
    result.outputTokens = usage.output_tokens;
  }
  return result;
}
