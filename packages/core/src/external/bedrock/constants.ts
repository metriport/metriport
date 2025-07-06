export const ANTHROPIC_BEDROCK_VERSION = "bedrock-2023-05-31";
export const CLAUDE_3_5_SONNET_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0" as const;
export const CLAUDE_3_7_SONNET_MODEL_ID = "us.anthropic.claude-3-7-sonnet-20250219-v1:0" as const;

export enum AnthropicModel {
  CLAUDE_3_HAIKU = "us.anthropic.claude-3-haiku-20240307-v1:0",
  CLAUDE_3_5_HAIKU = "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  CLAUDE_3_5_SONNET = "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  CLAUDE_3_7_SONNET = "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
}

export const DEFAULT_MAX_TOKENS = 1000;
export const DEFAULT_TEMPERATURE = 0;
