export type BedrockRegion = "us-east-1" | "us-east-2" | "us-west-2";

export interface BedrockConfig {
  region: BedrockRegion;
  model: string;
}

export interface InvokeMessage {
  role: "user" | "assistant";
  content: Array<InvokeMessageText | InvokeToolCall | InvokeToolResult>;
}

export interface InvokeResponseMessage {
  type: "text";
  text: string;
}

export interface InvokeThinkingMessage {
  type: "thinking";
  text: string;
  signature: string;
}

export interface InvokeToolCall<T = unknown> {
  type: "tool_use";
  id: string;
  name: string;
  input: T;
}

export interface InvokeToolResult {
  type: "tool_result";
  tool_use_id: string;
  content?: unknown;
}

export interface InvokeMessageText {
  type: "text";
  text: string;
}

export interface InvokeTool {
  type: "custom";
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface BedrockToolConfig {
  type: "custom";
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
