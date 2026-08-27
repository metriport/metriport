import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { PromptTemplate } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { timed } from "@metriport/shared/util/duration";
import { LLMChain, MapReduceDocumentsChain, StuffDocumentsChain } from "langchain/chains";
import { analytics, EventTypes } from "../../external/analytics/posthog";
import { out } from "../../util";
import {
  isAiBriefV2FeatureFlagEnabledForCx,
  isRecentVisitAiSummaryEnabledForCx,
  isCardiacCareAiSummaryEnabledForCx,
  isNitratesAndConditionsAiSummaryEnabledForCx,
  isPcpVisitAiSummaryFeatureFlagEnabledForCx,
  isCardiacCareV2AiSummaryFeatureFlagEnabledForCx,
} from "../feature-flags/domain-ffs";
import {
  documentVariableName as cardiacCareDocumentVariableName,
  mainSummaryPrompt as cardiacCareMainSummaryPrompt,
  refinedSummaryPrompt as cardiacCareRefinedSummaryPrompt,
} from "./cardiac-care-prompt";
import {
  documentVariableName as nitratesAndConditionsDocumentVariableName,
  mainSummaryPrompt as nitratesAndConditionsMainSummaryPrompt,
  refinedSummaryPrompt as nitratesAndConditionsRefinedSummaryPrompt,
} from "./nitrates-and-conditions-prompt";
import {
  documentVariableName as pcpVisitDocumentVariableName,
  mainSummaryPrompt as pcpVisitMainSummaryPrompt,
  refinedSummaryPrompt as pcpVisitRefinedSummaryPrompt,
} from "./pcp-visit-prompt";
import {
  documentVariableName as recentVisitDocumentVariableName,
  mainSummaryPrompt as recentVisitMainSummaryPrompt,
  refinedSummaryPrompt as recentVisitRefinedSummaryPrompt,
} from "./recent-visit-prompt";
import {
  documentVariableName as cardiacCareV2DocumentVariableName,
  mainSummaryPrompt as cardiacCareV2MainSummaryPrompt,
  refinedSummaryPrompt as cardiacCareV2RefinedSummaryPrompt,
} from "./cardiac-care-v2-prompt";
import { getAiBriefModel, getBaseChatModel } from "./provider";
import { documentVariableName, mainSummaryPrompt, refinedSummaryPrompt } from "./prompts";
import {
  AI_BRIEF_V2_MODEL,
  AiBriefControls,
  AiBriefModel,
  calculateCostsBasedOnTokens,
} from "./shared";
import { LLMResult } from "@langchain/core/outputs";
import { getPromptsForSummarizationV2 } from "./prompts-v2";

const CHUNK_SIZE = 100_000;
const CHUNK_OVERLAP = 1000;
const REASONING_END_TAG = "</reasoning>";

//--------------------------------
// AI-based brief generation
//--------------------------------
export async function summarizeFilteredBundleWithAI(
  cxId: string,
  patientId: string,
  bundleText: string,
  aiBriefControls?: AiBriefControls
): Promise<string | undefined> {
  const startedAt = new Date();
  const aiBriefModel = await getAiBriefModel(cxId, aiBriefControls);

  const { log } = out(
    `summarizeFilteredBundleWithAI - cxId ${cxId}, patientId ${patientId}, model ${aiBriefModel}`
  );
  try {
    const getInputsPromise = timed(
      () => getInputsForAiBriefGeneration(cxId, aiBriefModel),
      `getInputsForAiBriefGeneration`,
      log
    );
    const createDocsPromise = timed(
      () => {
        // TODO: #2510 - experiment with different splitters
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: CHUNK_SIZE,
          chunkOverlap: CHUNK_OVERLAP,
        });
        return textSplitter.createDocuments([bundleText ?? ""]);
      },
      `textSplitter.createDocuments`,
      log
    );
    const [getInputsResult, docs] = await Promise.all([getInputsPromise, createDocsPromise]);
    const { documentVariable, mainPrompt, refinedPrompt } = getInputsResult;

    const totalTokensUsed = {
      input: 0,
      output: 0,
    };

    const llmSummary = await getBaseChatModel(aiBriefModel, [
      {
        handleLLMEnd: function (output) {
          incrementTotalTokensUsed(totalTokensUsed, output);
        },
      },
    ]);

    const SUMMARY_PROMPT = PromptTemplate.fromTemplate(mainPrompt);
    const summaryChain = new LLMChain({
      llm: llmSummary as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      prompt: SUMMARY_PROMPT as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const SUMMARY_PROMPT_REFINED = PromptTemplate.fromTemplate(refinedPrompt);
    const summaryChainRefined = new StuffDocumentsChain({
      llmChain: new LLMChain({
        llm: llmSummary as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        prompt: SUMMARY_PROMPT_REFINED as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
      documentVariableName: documentVariable,
    });

    const mapReduce = new MapReduceDocumentsChain({
      llmChain: summaryChain,
      combineDocumentChain: summaryChainRefined,
      documentVariableName: documentVariable,
      verbose: false,
    });

    if (aiBriefControls && aiBriefControls.cancelled) {
      log(`AI Brief generation cancelled`);
      return undefined;
    }

    const summary = (await timed(
      () => mapReduce.invoke({ input_documents: docs }) as Promise<{ text: string }>,
      `mapReduce.invoke`,
      log
    )) as { text: string };

    // Remove <reasoning>...</reasoning> from the final summary when using GPT-OSS-120B
    const reasoningEndTagIndex = summary.text?.indexOf(REASONING_END_TAG);
    if (summary.text && reasoningEndTagIndex !== -1) {
      summary.text = summary.text.substring(reasoningEndTagIndex + REASONING_END_TAG.length);
    }

    const costs = calculateCostsBasedOnTokens(totalTokensUsed, aiBriefModel);

    // TODO: remove this once there is a better way to pass token usage and other
    // LLM-provider related metrics out of this function. This is currently needed for
    // benchmarking and comparisons between providers.
    if (aiBriefControls) {
      aiBriefControls.inputTokensUsed = totalTokensUsed.input;
      aiBriefControls.outputTokensUsed = totalTokensUsed.output;
    }

    const duration = elapsedTimeFromNow(startedAt);
    log(
      `Done. Finished in ${duration} ms. Total tokens used: ${JSON.stringify(
        totalTokensUsed
      )}. Input cost: ${costs.input}, output cost: ${costs.output}. Total cost: ${costs.total}`
    );

    analytics({
      distinctId: cxId,
      event: EventTypes.aiBriefGeneration,
      properties: {
        patientId,
        duration,
        totalTokensUsed,
        costs,
      },
    });
    if (!summary.text) return undefined;
    return summary.text;
  } catch (err) {
    const msg = `AI brief generation failure`;
    log(`${msg} - ${errorToString(err)}`);
    // Intentionally not throwing the error to avoid breaking the MR Summary generation flow
    throw err;
  }
}

/**
 * Increments the total token usage from either a Bedrock "usage" object or an OpenAI "tokenUsage" object.
 */
function incrementTotalTokensUsed(
  totalTokensUsed: { input: number; output: number },
  result: LLMResult
) {
  const usage = result.llmOutput?.usage;
  if (usage) {
    totalTokensUsed.input += usage.input_tokens;
    totalTokensUsed.output += usage.output_tokens;
  } else {
    const openAiUsage = result.llmOutput?.tokenUsage;
    if (openAiUsage) {
      totalTokensUsed.input += openAiUsage.promptTokens;
      totalTokensUsed.output += openAiUsage.completionTokens;
    }
  }
}

async function getInputsForAiBriefGeneration(
  cxId: string,
  aiBriefModel: AiBriefModel
): Promise<{
  mainPrompt: string;
  refinedPrompt: string;
  documentVariable: string;
}> {
  const isAiBriefV2 = await isAiBriefV2FeatureFlagEnabledForCx(cxId);
  const isCardiacCareV2AiSummary = await isCardiacCareV2AiSummaryFeatureFlagEnabledForCx(cxId);
  const isNitratesAndConditions = await isNitratesAndConditionsAiSummaryEnabledForCx(cxId);
  const isCardiacCare = await isCardiacCareAiSummaryEnabledForCx(cxId);
  const isRecentVisit = await isRecentVisitAiSummaryEnabledForCx(cxId);
  const isPcpVisit = await isPcpVisitAiSummaryFeatureFlagEnabledForCx(cxId);

  // If the AI Brief V2 feature flag is enabled, or this is for a non-Anthropic LLM,
  // then use the prompts-v2 library to get the prompts. This should maintain the same
  // order as the conditions below for the V1 AI briefs feature!
  if (isAiBriefV2 || aiBriefModel === AI_BRIEF_V2_MODEL) {
    const format = isCardiacCareV2AiSummary
      ? "cardiac-care-v2"
      : isNitratesAndConditions
      ? "nitrates-and-conditions"
      : isCardiacCare
      ? "cardiac-care"
      : isRecentVisit
      ? "recent-visit"
      : isPcpVisit
      ? "pcp-visit"
      : "default";
    return getPromptsForSummarizationV2(format);
  }

  // Order matters! Most specific prompts should be checked first
  if (isCardiacCareV2AiSummary) {
    return {
      mainPrompt: cardiacCareV2MainSummaryPrompt,
      refinedPrompt: cardiacCareV2RefinedSummaryPrompt,
      documentVariable: cardiacCareV2DocumentVariableName,
    };
  }

  if (isNitratesAndConditions) {
    return {
      mainPrompt: nitratesAndConditionsMainSummaryPrompt,
      refinedPrompt: nitratesAndConditionsRefinedSummaryPrompt,
      documentVariable: nitratesAndConditionsDocumentVariableName,
    };
  }

  if (isCardiacCare) {
    return {
      mainPrompt: cardiacCareMainSummaryPrompt,
      refinedPrompt: cardiacCareRefinedSummaryPrompt,
      documentVariable: cardiacCareDocumentVariableName,
    };
  }

  if (isRecentVisit) {
    return {
      mainPrompt: recentVisitMainSummaryPrompt,
      refinedPrompt: recentVisitRefinedSummaryPrompt,
      documentVariable: recentVisitDocumentVariableName,
    };
  }

  if (isPcpVisit) {
    return {
      mainPrompt: pcpVisitMainSummaryPrompt,
      refinedPrompt: pcpVisitRefinedSummaryPrompt,
      documentVariable: pcpVisitDocumentVariableName,
    };
  }

  // Default fallback
  return {
    mainPrompt: mainSummaryPrompt,
    refinedPrompt: refinedSummaryPrompt,
    documentVariable: documentVariableName,
  };
}
