export type AnthropicModelVersion = "claude-sonnet-3.5" | "claude-sonnet-3.7" | "claude-sonnet-4";

const modelIdMapping: Record<AnthropicModelVersion, string> = {
  "claude-sonnet-3.5": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  "claude-sonnet-3.7": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "claude-sonnet-4": "us.anthropic.claude-sonnet-4-20250514-v1:0",
};

export function getAnthropicModelId(version: AnthropicModelVersion): string {
  return modelIdMapping[version];
}
