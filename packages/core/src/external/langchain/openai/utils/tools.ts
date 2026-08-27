import { OpenAI as OpenAIClient } from "openai";

import { ToolDefinition } from "@langchain/core/language_models/base";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";
import { convertToOpenAIFunction, isLangChainTool } from "@langchain/core/utils/function_calling";
import { zodFunction } from "openai/helpers/zod";

export function _convertToOpenAITool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: BindToolsInput,
  fields?: {
    strict?: boolean;
  }
): OpenAIClient.ChatCompletionTool {
  let toolDef: OpenAIClient.ChatCompletionTool | undefined;

  if (isLangChainTool(tool)) {
    const oaiToolDef = zodFunction({
      name: tool.name,
      parameters: tool.schema,
      description: tool.description,
    });
    if (!oaiToolDef.function.parameters) {
      toolDef = {
        type: "function",
        function: convertToOpenAIFunction(tool, fields),
      };
    } else {
      toolDef = {
        type: oaiToolDef.type,
        function: {
          name: oaiToolDef.function.name,
          description: oaiToolDef.function.description ?? "",
          parameters: oaiToolDef.function.parameters,
          ...(fields?.strict !== undefined ? { strict: fields.strict } : {}),
        },
      };
    }
  } else {
    toolDef = tool as ToolDefinition;
  }

  if (fields?.strict !== undefined) {
    toolDef.function.strict = fields.strict;
  }

  return toolDef;
}
