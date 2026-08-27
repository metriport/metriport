import {
  mainSummaryPrompt as nitratesAndConditionsMainSummaryPrompt,
  refinedSummaryPrompt as nitratesAndConditionsRefinedSummaryPrompt,
  documentVariableName as nitratesAndConditionsDocumentVariableName,
} from "./nitrates-and-conditions-prompt";
import {
  mainSummaryPrompt as cardiacCareMainSummaryPrompt,
  refinedSummaryPrompt as cardiacCareRefinedSummaryPrompt,
  documentVariableName as cardiacCareDocumentVariableName,
} from "./cardiac-care-prompt";
import {
  mainSummaryPrompt as recentVisitMainSummaryPrompt,
  refinedSummaryPrompt as recentVisitRefinedSummaryPrompt,
  documentVariableName as recentVisitDocumentVariableName,
} from "./recent-visit-prompt";
import {
  mainSummaryPrompt as pcpVisitMainSummaryPrompt,
  refinedSummaryPrompt as pcpVisitRefinedSummaryPrompt,
  documentVariableName as pcpVisitDocumentVariableName,
} from "./pcp-visit-prompt";
import {
  mainSummaryPrompt as cardiacCareV2MainSummaryPrompt,
  refinedSummaryPrompt as cardiacCareV2RefinedSummaryPrompt,
  documentVariableName as cardiacCareV2DocumentVariableName,
} from "./cardiac-care-v2-prompt";

import { buildSummaryPrompt } from "./prompt-builder";
import { getSummaryPromptConfig } from "./prompt-config";

export const PROMPT_FORMAT = [
  "nitrates-and-conditions",
  "cardiac-care",
  "recent-visit",
  "pcp-visit",
  "cardiac-care-v2",
  "default",
] as const;

export type PromptFormat = (typeof PROMPT_FORMAT)[number];

export interface SummaryPrompts {
  mainPrompt: string;
  refinedPrompt: string;
  documentVariable: string;
}

/**
 * Uses the original prompts for non-default prompt formats, and expects that the specialized prompts
 * are passed to the original Bedrock client.
 */
export function getPromptsForSummarizationV2(format: PromptFormat): SummaryPrompts {
  switch (format) {
    case "cardiac-care-v2":
      return {
        mainPrompt: cardiacCareV2MainSummaryPrompt,
        refinedPrompt: cardiacCareV2RefinedSummaryPrompt,
        documentVariable: cardiacCareV2DocumentVariableName,
      };
    case "nitrates-and-conditions":
      return {
        mainPrompt: nitratesAndConditionsMainSummaryPrompt,
        refinedPrompt: nitratesAndConditionsRefinedSummaryPrompt,
        documentVariable: nitratesAndConditionsDocumentVariableName,
      };
    case "cardiac-care":
      return {
        mainPrompt: cardiacCareMainSummaryPrompt,
        refinedPrompt: cardiacCareRefinedSummaryPrompt,
        documentVariable: cardiacCareDocumentVariableName,
      };
    case "recent-visit":
      return {
        mainPrompt: recentVisitMainSummaryPrompt,
        refinedPrompt: recentVisitRefinedSummaryPrompt,
        documentVariable: recentVisitDocumentVariableName,
      };
    case "pcp-visit":
      return {
        mainPrompt: pcpVisitMainSummaryPrompt,
        refinedPrompt: pcpVisitRefinedSummaryPrompt,
        documentVariable: pcpVisitDocumentVariableName,
      };
    case "default":
    default:
      return buildSummaryPrompt(getSummaryPromptConfig("default"));
  }
}
