import { AnthropicAgent } from "../../../external/bedrock/agent/anthropic";
import { BedrockRegion } from "../../../external/bedrock/client";
import { AnthropicMessageText } from "../../../external/bedrock/model/anthropic/messages";
import { AnthropicModelVersion } from "../../../external/bedrock/model/anthropic/version";
import { out } from "../../../util/log";
import { chunkWithOverlap } from "../../../util/string";
import {
  getResourceSummaryCollationPrompt,
  getResourceSummaryPrompt,
  systemPrompt,
} from "./prompts";

const defaultModel: AnthropicModelVersion = "claude-sonnet-3.7";
const defaultRegion: BedrockRegion = "us-west-2";

/**
 * The usual estimate is every 4 characters is a token.
 * @param context
 * @returns
 */
function getCharacterCountForTokens(tokenCount: number) {
  return tokenCount * 4;
}

export type ResourceInference = {
  resourceType: string;
  resourceDisplays: string[];
  questions: string[];
  context: string;
};

export async function summarizeContext({
  resourceType,
  resourceDisplays,
  questions,
  context,
}: ResourceInference): Promise<string | undefined> {
  const { log } = out(`summarizeContext`);

  const modelContextWindowTokens = 128_000;
  const contextWindowSafetyMargin = 0.85;
  const chunkSizeChars = getCharacterCountForTokens(
    modelContextWindowTokens * contextWindowSafetyMargin
  );
  const chunkOverlap = chunkSizeChars * 0.1;
  const chunks = chunkWithOverlap(context, chunkSizeChars, chunkOverlap);
  log(`Source context length: ${context.length} characters\nSummarizing ${chunks.length} chunks`);

  // Create all summaries
  const responses = await Promise.all(
    chunks.map(chunk =>
      summarizeChunk({ resourceType, resourceDisplays, questions, context: chunk })
    )
  );

  // Collate summaries
  return await collateSummaries({
    resourceType,
    resourceDisplays,
    questions,
    summaries: responses,
  });
}

export async function summarizeChunk({
  resourceType,
  resourceDisplays,
  questions,
  context,
}: ResourceInference): Promise<string> {
  const agent = new AnthropicAgent({
    version: defaultModel,
    region: defaultRegion,
    systemPrompt,
    tools: [],
  });

  const prompt = getResourceSummaryPrompt({ resourceType, resourceDisplays, questions, context });

  agent.addUserMessageText(prompt);

  const response = await agent.continueConversation();

  const message = (response.content[response.content.length - 1] as AnthropicMessageText).text;
  return message;
}

export async function collateSummaries({
  resourceType,
  resourceDisplays,
  questions,
  summaries,
}: {
  resourceType: string;
  resourceDisplays: string[];
  questions: string[];
  summaries: string[];
}): Promise<string> {
  const agent = new AnthropicAgent({
    version: defaultModel,
    region: defaultRegion,
    systemPrompt,
    tools: [],
  });

  const prompt = getResourceSummaryCollationPrompt({
    resourceType,
    resourceDisplays,
    questions,
    responses: summaries,
  });

  agent.addUserMessageText(prompt);

  const response = await agent.continueConversation();

  const message = (response.content[response.content.length - 1] as AnthropicMessageText).text;
  return message;
}
