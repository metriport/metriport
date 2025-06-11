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
import { BedrockChat } from "../../external/langchain/bedrock";
import { out } from "../../util";
import { isPcpVisitAiSummaryFeatureFlagEnabledForCx } from "../feature-flags/domain-ffs";
import {
  documentVariableName as pcpVisitDocumentVariableName,
  mainSummaryPrompt as pcpVisitMainSummaryPrompt,
  refinedSummaryPrompt as pcpVisitRefinedSummaryPrompt,
} from "./pcp-visit-prompt";
import { documentVariableName, mainSummaryPrompt, refinedSummaryPrompt } from "./prompts";
import { AiBriefControls } from "./shared";

const CHUNK_SIZE = 100_000;
const CHUNK_OVERLAP = 1000;

const SONNET_COST_PER_INPUT_TOKEN = 0.0015 / 1000;
const SONNET_COST_PER_OUTPUT_TOKEN = 0.0075 / 1000;

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
  const { log } = out(`summarizeFilteredBundleWithAI - cxId ${cxId}, patientId ${patientId}`);
  try {
    const getInputsPromise = timed(
      () => getInputsForAiBriefGeneration(cxId),
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

    const llmSummary = new BedrockChat({
      model: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      temperature: 0,
      region: "us-west-2",
      callbacks: [
        {
          handleLLMEnd: output => {
            const usage = output.llmOutput?.usage;
            if (usage) {
              totalTokensUsed.input += usage.input_tokens;
              totalTokensUsed.output += usage.output_tokens;
            }
          },
        },
      ],
    });

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

    const costs = calculateCostsBasedOnTokens(totalTokensUsed);

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

async function getInputsForAiBriefGeneration(cxId: string): Promise<{
  mainPrompt: string;
  refinedPrompt: string;
  documentVariable: string;
}> {
  const isPcpVisit = await isPcpVisitAiSummaryFeatureFlagEnabledForCx(cxId);

  if (isPcpVisit) {
    return {
      mainPrompt: pcpVisitMainSummaryPrompt,
      refinedPrompt: pcpVisitRefinedSummaryPrompt,
      documentVariable: pcpVisitDocumentVariableName,
    };
  }

  return {
    mainPrompt: mainSummaryPrompt,
    refinedPrompt: refinedSummaryPrompt,
    documentVariable: documentVariableName,
  };
}

function calculateCostsBasedOnTokens(totalTokens: { input: number; output: number }): {
  input: number;
  output: number;
  total: number;
} {
  const input = totalTokens.input * SONNET_COST_PER_INPUT_TOKEN;
  const output = totalTokens.output * SONNET_COST_PER_OUTPUT_TOKEN;
  const total = input + output;

  return { input, output, total };
}
