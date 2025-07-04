import type { ComprehendAgent } from "./agent";
import type { LLMResult } from "@langchain/core/outputs";
import { ToolCall } from "@langchain/core/messages/tool";

export function buildUsageCallback(agent: ComprehendAgent) {
  return {
    handleLLMEnd: function (output: LLMResult) {
      const usage = output.llmOutput?.usage;
      if (
        usage &&
        typeof usage === "object" &&
        isNumber(usage.input_tokens) &&
        isNumber(usage.output_tokens)
      ) {
        agent.incrementLLMUsage(usage);
      }
    },
  };
}

export function buildToolStartCallback(agent: ComprehendAgent) {
  return {
    handleToolStart(
      tool: ToolCall,
      input: string,
      runId: string,
      parentRunId: string,
      tags: string[],
      metadata: Record<string, string>,
      runName: string
    ) {
      console.log("Tool started", tool, input, runId, parentRunId, tags, metadata, runName);
      console.log(agent != null);
    },
  };
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
