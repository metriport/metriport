export interface AnthropicTool {
  type: "custom";
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
