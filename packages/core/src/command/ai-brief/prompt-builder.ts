import { z } from "zod";
import { buildDayjs } from "@metriport/shared/common/date";
import { createPromptBuilder } from "../../util/prompt-template";

/**
 * Schema and template for the initial summarization prompt.
 */
const mainPromptSchema = z.object({
  systemPrompt: z.string(),
  documentContent: z.string(),
  initialGoals: z.string(),
  doNotCommentInstruction: z.string(),
});

const MAIN_PROMPT_TEMPLATE = `{{ systemPrompt }}
Here is a portion of the patient's medical history:
--------
{{ documentContent }}
--------
Instructions for writing the summary:
{{ initialGoals }}

{{ doNotCommentInstruction }}

SUMMARY:
`;

/**
 * Schema and template for the refined summarization prompt.
 */
const refinedPromptSchema = z.object({
  systemPrompt: z.string(),
  todaysDate: z.string(),
  documentContent: z.string(),
  finalGoals: z.string(),
  goodExamplesSection: z.string(),
  badExamplesSection: z.string(),
  doNotCommentInstruction: z.string(),
});

const REFINED_PROMPT_TEMPLATE = `{{ systemPrompt }}
Today's date is {{ todaysDate }}.
Here are the previous summaries written by you of sections of the patient's medical history:
--------
{{ documentContent }}
--------
Combine these summaries into a single, comprehensive summary of the patient's most recent medical history.

Important instructions for writing the final summary:
{{ finalGoals }}

{{ goodExamplesSection }}

{{ badExamplesSection }}

{{ doNotCommentInstruction }}

SUMMARY:
`;

const generateMainPrompt = createPromptBuilder(MAIN_PROMPT_TEMPLATE, mainPromptSchema);
const generateRefinedPrompt = createPromptBuilder(REFINED_PROMPT_TEMPLATE, refinedPromptSchema);

export interface PromptConfig {
  /**
   * A clear and concise directive on the role that the LLM is carrying out and the language to use in the summary output.
   */
  systemPrompt: string;
}

export interface SummaryPromptConfig extends PromptConfig {
  /**
   * The initial goals when performing the initial summarization of the document content.
   */
  initialGoals: GoalConfig[];

  /**
   * The goals for performing the final refinement of the summary.
   */
  finalGoals: GoalConfig[];

  /**
   * A set of good examples to provide the LLM that writes the final summary.
   */
  goodExamples?: ExampleConfig[];

  /**
   * A set of bad examples to provide the LLM that writes the final summary.
   */
  badExamples?: ExampleConfig[];
}

interface GoalConfig {
  goal: string;
  enabled?: boolean;
}

interface ExampleConfig {
  example: string;
  explanation: string;
  enabled?: boolean;
}

const DO_NOT_COMMENT_INSTRUCTION =
  "Do not tell me you are writing a summary, just write the summary. Do not comment.";
const DOCUMENT_VARIABLE_NAME = "text";

export function buildSummaryPrompt({
  systemPrompt,
  initialGoals,
  finalGoals,
  goodExamples,
  badExamples,
}: SummaryPromptConfig): { mainPrompt: string; refinedPrompt: string; documentVariable: string } {
  const todaysDate = buildDayjs().format("YYYY-MM-DD");
  const enabledInitialGoals = initialGoals?.filter(isEnabled);
  const enabledFinalGoals = finalGoals?.filter(isEnabled);
  const enabledGoodExamples = goodExamples?.filter(isEnabled) ?? [];
  const enabledBadExamples = badExamples?.filter(isEnabled) ?? [];

  const initialGoalsText = enabledInitialGoals.map(goal => `- ${goal.goal}`).join("\n");
  const finalGoalsText = enabledFinalGoals.map(goal => `- ${goal.goal}`).join("\n");
  const goodExamplesText =
    enabledGoodExamples.length > 0
      ? `GOOD EXAMPLES:\n${enabledGoodExamples
          .map(
            ({ example, explanation }) =>
              `GOOD EXAMPLE: ${example}\nReason this is a good example: ${explanation}`
          )
          .join("\n")}`
      : "";

  const badExamplesText =
    enabledBadExamples.length > 0
      ? `BAD EXAMPLES:\n${enabledBadExamples
          .map(
            ({ example, explanation }) =>
              `BAD EXAMPLE: ${example}\nReason this is a bad example: ${explanation}`
          )
          .join("\n")}`
      : "";

  const mainPrompt = generateMainPrompt({
    systemPrompt,
    documentContent: `{${DOCUMENT_VARIABLE_NAME}}`,
    initialGoals: initialGoalsText,
    doNotCommentInstruction: DO_NOT_COMMENT_INSTRUCTION,
  });

  const refinedPrompt = generateRefinedPrompt({
    systemPrompt,
    todaysDate,
    documentContent: `{${DOCUMENT_VARIABLE_NAME}}`,
    finalGoals: finalGoalsText,
    goodExamplesSection: goodExamplesText,
    badExamplesSection: badExamplesText,
    doNotCommentInstruction: DO_NOT_COMMENT_INSTRUCTION,
  });

  return { mainPrompt, refinedPrompt, documentVariable: DOCUMENT_VARIABLE_NAME };
}

function isEnabled(config: { enabled?: boolean }): boolean {
  return config.enabled !== false;
}
