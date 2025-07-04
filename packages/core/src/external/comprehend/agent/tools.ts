import { z } from "zod";
import { ToolCall } from "@langchain/core/messages/tool";
import {
  ExtractionFeature,
  ExtractionFeatureType,
  ExtractionFeaturePrompt,
  ExtractionToolCall,
} from "../types";
import { BaseMessageLike } from "@langchain/core/messages";

export function buildToolDefinition(feature: ExtractionFeature) {
  return {
    name: getToolName(feature),
    description: getToolDescription(feature),
    schema: z.object({ text: z.string() }),
  };
}

export function buildExtractionToolCall(toolCall: ToolCall): ExtractionToolCall {
  const type = getExtractionFeatureType(toolCall.name);
  if (!type) throw new Error(`Unknown tool call: ${toolCall.name}`);

  return {
    type,
    text: toolCall.args.text,
  };
}

/**
 * We do not need to pass the result of the tool call back to the LLM, since it is only extracting chunks of
 * text and not performing any work on the extracted FHIR resources.
 * @param toolCall
 * @returns
 */
export function buildExtractionToolResult(toolCall: ToolCall): BaseMessageLike {
  return {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolCall.id,
      },
    ],
  };
}

export const extractionFeaturePrompt: Record<ExtractionFeatureType, ExtractionFeaturePrompt> = {
  condition: {
    toolName: "extractConditions",
    toolDescription: "Extract medical conditions with ICD-10-CM codes",
    toolPrompt: `The "extractConditions" tool extracts conditions with ICD-10-CM codes`,
  },
  procedure: {
    toolName: "extractProcedures",
    toolDescription: "Extract medical procedures with SNOMED CT codes",
    toolPrompt: `The "extractProcedures" tool extracts procedures with SNOMED CT codes`,
  },
  medication: {
    toolName: "extractMedications",
    toolDescription: "Extract medication information using RxNorm codes",
    toolPrompt: `The "extractMedications" tool extracts medication information using RxNorm codes`,
  },
};

const extractionFeatureNameToType: Record<string, ExtractionFeatureType> = Object.fromEntries(
  Object.entries(extractionFeaturePrompt).map(([key, value]) => [
    value.toolName,
    key as ExtractionFeatureType,
  ])
);

export function getExtractionFeatureType(toolName: string): ExtractionFeatureType | undefined {
  return extractionFeatureNameToType[toolName];
}

export function getToolName(feature: ExtractionFeature) {
  return extractionFeaturePrompt[feature.type].toolName;
}

export function getToolDescription(feature: ExtractionFeature) {
  return extractionFeaturePrompt[feature.type].toolDescription;
}
