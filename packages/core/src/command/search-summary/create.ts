import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { BedrockChat } from "../../external/langchain/bedrock";
import { out } from "../../util";
import { createPromptWithJsonOutput } from "./prompts";
import { DocumentReferenceWithId } from "../../external/fhir/document/document-reference";

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
};

//--------------------------------
// AI-based search summary generation
//--------------------------------
export async function generateSearchSummary(
  docs: DocumentReferenceWithId[],
  query: string
): Promise<SearchSummaryOutput | undefined> {
  const startedAt = new Date();
  const { log } = out(`generateSearchSummary`);

  try {
    // Generate text from document references that identifies each document
    const bundleText = extractTextFromDocumentReferences(docs);

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

    const promptText = createPromptWithJsonOutput(query, bundleText);

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

    console.log(`result: ${result.text}`);

    // Parse the LLM output to extract the summary and citations
    const outputWithCitations = parseSummaryWithCitations(result.text);
    return outputWithCitations;
  } catch (err) {
    const msg = `AI brief generation failure`;
    log(`${msg} - ${errorToString(err)}`);
    throw err;
  }
}

/**
 * Extracts text content from DocumentReference objects with document identifiers
 * to allow for citation references
 */
function extractTextFromDocumentReferences(docs: DocumentReferenceWithId[]): string {
  return docs
    .map((doc, index) => {
      // Create a unique citation ID for this document
      const docIndex = index + 1;
      const docId = doc.id;
      const docType = doc.type?.coding?.[0]?.display || "Unknown document type";
      const docDate = doc.date || "Unknown date";

      // Extract content - real implementation would extract actual document content
      // This could be from doc.content[0].attachment.data (if base64 encoded) or by
      // fetching from doc.content[0].attachment.url
      const description = doc.description || "No description available";

      // Format with document index for citation purposes
      return `[DOCUMENT ${docIndex}]
ID: ${docId}
TYPE: ${docType}
DATE: ${docDate}
DESCRIPTION: ${description}
-----END OF DOCUMENT ${docIndex}-----

`;
    })
    .join("\n");
}

/**
 * Parse LLM response to extract citations
 * This parses a summary with citation markers in [DOC X] format
 */
async function parseSummaryWithCitations(llmResponse: string): Promise<SearchSummaryOutput> {
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
    };
  } catch (error) {
    console.error("Error parsing LLM response:", error);
    throw new Error("Failed to process summary");
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
