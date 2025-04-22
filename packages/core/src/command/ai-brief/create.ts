import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { PromptTemplate } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { LLMChain, MapReduceDocumentsChain, StuffDocumentsChain } from "langchain/chains";
import { EventTypes, analytics } from "../../external/analytics/posthog";
import { BedrockChat } from "../../external/langchain/bedrock";
import { out } from "../../util";
// import { documentVariableName, mainSummaryPrompt, refinedSummaryPrompt } from "./prompts";
import { documentVariableName, mainSummaryPrompt, refinedSummaryPrompt } from "./custom-prompt";

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
  bundleText: string
): Promise<string | undefined> {
  const startedAt = new Date();
  const { log } = out(`summarizeFilteredBundleWithAI - cxId ${cxId}, patientId ${patientId}`);
  // filter out historical data
  try {
    // TODO: #2510 - experiment with different splitters
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    const docs = await textSplitter.createDocuments([bundleText ?? ""]);
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

    const SUMMARY_PROMPT = PromptTemplate.fromTemplate(mainSummaryPrompt);
    const summaryChain = new LLMChain({
      llm: llmSummary as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      prompt: SUMMARY_PROMPT as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const SUMMARY_PROMPT_REFINED = PromptTemplate.fromTemplate(refinedSummaryPrompt);
    const summaryChainRefined = new StuffDocumentsChain({
      llmChain: new LLMChain({
        llm: llmSummary as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        prompt: SUMMARY_PROMPT_REFINED as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
      documentVariableName,
    });

    const mapReduce = new MapReduceDocumentsChain({
      llmChain: summaryChain,
      combineDocumentChain: summaryChainRefined,
      documentVariableName,
      verbose: false,
    });

    const summary = (await mapReduce.invoke({
      input_documents: docs,
    })) as { text: string };

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
