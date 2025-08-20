import { FhirBundleSdk } from "@metriport/fhir-sdk";
// import { RXNORM_URL } from "@metriport/shared/medical";
import { AnthropicAgent } from "../../bedrock/agent/anthropic";
import { AnthropicTool } from "../../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "../client";
import {
  ExtractedMedication,
  ExtractTextRequest,
  extractTextRequestSchema,
  ExtractTextResponse,
  extractTextResponseSchema,
} from "../types";

/**
 * The comprehendMedications tool passes a chunk of unstructured text to a specialized agent that focuses on extracting accurate
 * medication-related FHIR resources. The goal of the medication agent is solely to produce accurate Medication, MedicationStatement, and
 * MedicationRequest resources, which are passed back to the orchestrator agent.
 *
 * @param bundle
 * @param client
 * @returns
 */
export function buildComprehendMedicationTool(
  bundle: FhirBundleSdk,
  client: ComprehendClient = new ComprehendClient()
): AnthropicTool<ExtractTextRequest, ExtractTextResponse> {
  const medicationAgent = new MedicationAgent(bundle, client);

  async function medicationToolHandler(input: ExtractTextRequest) {
    const medications = await medicationAgent.extractMedications(input.text);
    return medications;
  }

  return new AnthropicTool({
    name: "comprehendMedications",
    description:
      "An agent that extracts structured FHIR medication resources from the provided unstructured medical text.",
    inputSchema: extractTextRequestSchema,
    outputSchema: extractTextResponseSchema,
    handler: medicationToolHandler,
  });
}

export class MedicationAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  private readonly comprehend: ComprehendClient;

  constructor(bundle: FhirBundleSdk, comprehend: ComprehendClient = new ComprehendClient()) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: `You are an agent that receives unstructured text containing medication information, along with FHIR resources that were extracted from the bundle.`,
    });
    this.comprehend = comprehend;
  }

  async extractMedications(text: string): Promise<ExtractedMedication[]> {
    const rxNormOutput = await this.comprehend.inferRxNorm(text);
    if (!rxNormOutput.Entities) return [];

    // TODO: agentic conversation loop to determine accuracy of all medications
    return [];
  }
}
