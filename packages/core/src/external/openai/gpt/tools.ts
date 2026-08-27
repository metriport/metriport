import { executeAsynchronously } from "../../../util/concurrency";
import { OpenAIResponse, OpenAIToolCall, OpenAIToolResult, OpenAIToolExecution } from "../types";
import { OpenAITool } from "../tool";

/**
 * Extract any tool calls from an OpenAI response.
 */
export function getToolCallsFromResponse(response: OpenAIResponse): OpenAIToolCall[] {
  const toolCalls: OpenAIToolCall[] = [];
  for (const choice of response.choices) {
    if (choice.message.tool_calls) {
      toolCalls.push(...choice.message.tool_calls);
    }
  }
  return toolCalls;
}

/**
 * Maps an array of tool calls to the provided array of available tools, and creates a validated
 * tool execution object for each valid tool call. This step only validates each tool call against
 * available tools, and does not execute the tools.
 *
 * @param tools - The array of tools to map from.
 * @param toolCalls - The array of tool calls to map to.
 */
export function buildToolExecutions(
  tools: OpenAITool[],
  toolCalls: OpenAIToolCall[]
): { toolExecutions: OpenAIToolExecution[]; toolErrors: OpenAIToolResult[] } {
  const toolExecutions: OpenAIToolExecution[] = [];
  const toolErrors: OpenAIToolResult[] = [];
  for (const toolCall of toolCalls) {
    const toolName = toolCall.function.name;
    const tool = tools.find(tool => tool.getName() === toolName);
    if (!tool) {
      toolErrors.push(buildToolResultError(toolCall, new Error(`Tool ${toolName} not found`)));
      continue;
    }
    try {
      // For tools that don't require arguments, the OpenAI API may pass an empty string which
      // fails JSON parsing, so this bypasses the error by passing an empty object if allowed.
      const toolArgumentString = toolCall.function.arguments;
      if (toolArgumentString === "" && tool.canExecute({})) {
        toolExecutions.push({ tool, toolCall, arg: {} });
        continue;
      }

      // Parse the tool argument as JSON, and return a tool error if the parsing fails.
      const toolArgument = JSON.parse(toolArgumentString);
      if (tool.canExecute(toolArgument)) {
        toolExecutions.push({ tool, toolCall, arg: toolArgument });
      } else {
        toolErrors.push(
          buildToolResultError(toolCall, new Error(`Tool ${toolName} input is invalid`))
        );
      }
    } catch (error) {
      toolErrors.push(buildToolResultError(toolCall, error));
    }
  }
  return { toolExecutions, toolErrors };
}

/**
 * Executes all tool executions asynchronously, and returns the array of tool results.
 * @param toolExecutions - The array of tool executions to execute.
 * @returns The array of tool results.
 */
export async function executeAllTools(
  toolExecutions: OpenAIToolExecution[],
  {
    numberOfParallelExecutions = toolExecutions.length,
  }: { numberOfParallelExecutions?: number } = {}
): Promise<OpenAIToolResult[]> {
  const toolResults: OpenAIToolResult[] = [];
  await executeAsynchronously(
    toolExecutions,
    async ({ tool, toolCall, arg }) => {
      const result = await tool.execute(arg);
      toolResults.push(buildToolResult(toolCall, result));
    },
    {
      numberOfParallelExecutions,
    }
  );
  return toolResults;
}

export function buildToolResult(toolCall: OpenAIToolCall, content?: unknown): OpenAIToolResult {
  const result: OpenAIToolResult = {
    role: "tool",
    tool_call_id: toolCall.id,
    // Expected by the OpenAI API to be defined, even as an empty string.
    content: "",
  };
  if (content == null) {
    return result;
  } else if (typeof content === "string") {
    result.content = content;
  } else {
    result.content = JSON.stringify(content);
  }

  return result;
}

export function buildToolResultError(toolCall: OpenAIToolCall, error: unknown): OpenAIToolResult {
  return buildToolResult(toolCall, {
    error: error instanceof Error ? error.message : String(error),
  });
}
