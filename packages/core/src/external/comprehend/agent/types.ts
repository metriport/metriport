import { BaseMessageLike } from "@langchain/core/messages";
import type { BedrockChat } from "../../langchain/bedrock";

export type BedrockAgent = ReturnType<typeof BedrockChat.prototype.bindTools>;
export type BedrockChatResult = Awaited<ReturnType<typeof BedrockChat.prototype.invoke>>;
export type BedrockChatThread = BaseMessageLike[];

export interface ExtractionBudget {
  tokensToLLM: number;
  charactersToComprehend: number;
}

export interface ExtractionUsage {
  llmInputTokens: number;
  llmOutputTokens: number;
  comprehendInputCharacters: number;
}
