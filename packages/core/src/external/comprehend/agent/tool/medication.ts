import { AnthropicAgent } from "../../../bedrock/agent/anthropic";
import { AnthropicTool } from "../../../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "../../client";
import { buildMedicationResources } from "../../fhir/medication";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";

export function buildComprehendMedicationTool(client: ComprehendClient = new ComprehendClient()) {
  const medicationAgent = new MedicationAgent(client);

  async function medicationToolHandler(input: ExtractTextRequest) {
    const medications = await medicationAgent.extractMedications(input.text);
    return medications;
  }

  return new AnthropicTool({
    name: "comprehendMedications",
    description: "An agent that extracts medication information from the provided medical text.",
    inputSchema: extractTextRequestSchema,
    handler: medicationToolHandler,
  });
}

export class MedicationAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  private readonly comprehend: ComprehendClient;
  constructor(comprehend: ComprehendClient = new ComprehendClient()) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: `You are an agent that receives unstructured text containing medication information, along with FHIR resources that were extracted from the bundle.`,
    });
    this.comprehend = comprehend;
  }

  async extractMedications(text: string) {
    const rxNormOutput = await this.comprehend.inferRxNorm(text);
    if (!rxNormOutput.Entities) return [];
    const medications = buildMedicationResources(rxNormOutput.Entities, {
      confidenceThreshold: 0.5,
    });

    // TODO: agentic conversation loop to determine accuracy of all medications

    return medications;
  }
}
