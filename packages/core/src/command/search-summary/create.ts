import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { errorToString } from "@metriport/shared";
import { MetriportError } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { BedrockChat } from "../../external/langchain/bedrock";
import { out } from "../../util";
import { createPromptWithJsonOutput } from "./prompts";
import { prepareBundleForAiSummarization } from "../ai-brief/filter";

const SONNET_COST_PER_INPUT_TOKEN = 0.0015 / 1000;
const SONNET_COST_PER_OUTPUT_TOKEN = 0.0075 / 1000;

type SearchSummaryOutput = {
  summary: string;
  citations: {
    id: string;
    marker: string;
    description: string;
    date: string;
    sourceId: string;
  }[];
  relevantResources: {
    id: string;
  }[];
};

//--------------------------------
// AI-based search summary generation
//--------------------------------
export async function generateSearchSummary(
  question: string,
  bundle: Bundle<Resource>
): Promise<SearchSummaryOutput | undefined> {
  const startedAt = new Date();
  const { log } = out(`generateSearchSummary - question ${question}`);
  // filter out historical data
  try {
    const bundleText = prepareBundleForAiSummarization(bundle, log);

    const totalTokensUsed = {
      input: 0,
      output: 0,
    };

    const llmSummary = new BedrockChat({
      model: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      temperature: 0,
      region: "us-west-2",
      maxTokens: 3000,
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

    const promptText = createPromptWithJsonOutput(question, bundleText);

    // Use the LLM directly with the complete prompt
    const result = await llmSummary.invoke(promptText);

    const costs = calculateCostsBasedOnTokens(totalTokensUsed);

    const duration = elapsedTimeFromNow(startedAt);
    log(
      `Done. Finished in ${duration} ms. Total tokens used: ${JSON.stringify(
        totalTokensUsed
      )}. Input cost: ${costs.input}, output cost: ${costs.output}. Total cost: ${costs.total}`
    );

    if (!result.text) return undefined;

    // Parse the LLM output to extract the summary and citations
    const outputWithCitations = parseSummaryWithCitations(result.text, log);
    return outputWithCitations;
  } catch (err) {
    const msg = `Search summary generation failure`;
    log(`${msg} - ${errorToString(err)}`);
    throw err;
  }
}

/**
 * Parse LLM response to extract citations
 * This parses a summary with citation markers in [DOC X] format
 */
async function parseSummaryWithCitations(
  llmResponse: string,
  log = console.log
): Promise<SearchSummaryOutput> {
  try {
    // Parse JSON response
    const parsedResponse = JSON.parse(llmResponse);

    // Validate expected structure
    if (!parsedResponse.summary || !Array.isArray(parsedResponse.citations)) {
      throw new Error("Invalid response structure");
    }

    return {
      summary: parsedResponse.summary,
      citations: parsedResponse.citations,
      relevantResources: parsedResponse.relevantResources,
    };
  } catch (error) {
    log(`Error parsing LLM response: ${errorToString(error)}`);
    throw new MetriportError("Failed to process summary", error);
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
