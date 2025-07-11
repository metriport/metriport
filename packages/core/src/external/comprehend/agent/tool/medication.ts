import { Bundle, Medication } from "@medplum/fhirtypes";
import { RXNORM_URL } from "../../../../util/constants";
import { AnthropicAgent } from "../../../bedrock/agent/anthropic";
import { AnthropicTool } from "../../../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "../../client";
import { buildMedicationResources } from "../../fhir/medication";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";

export function buildComprehendMedicationTool(
  bundle: Bundle,
  client: ComprehendClient = new ComprehendClient()
) {
  const medicationAgent = new MedicationAgent(bundle, client);

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
  private readonly currentRxNormCodes: Set<string>;

  constructor(bundle: Bundle, comprehend: ComprehendClient = new ComprehendClient()) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: `You are an agent that receives unstructured text containing medication information, along with FHIR resources that were extracted from the bundle.`,
    });
    this.comprehend = comprehend;
    this.currentRxNormCodes = getCurrentMedicationCodes(bundle);
  }

  async extractMedications(text: string) {
    const rxNormOutput = await this.comprehend.inferRxNorm(text);
    if (!rxNormOutput.Entities) return [];
    const medications = buildMedicationResources(rxNormOutput.Entities, {
      confidenceThreshold: 0.5,
    });

    if (this.currentRxNormCodes.size > 0) {
      console.log("checking for overlap");
    }

    // TODO: agentic conversation loop to determine accuracy of all medications

    return medications;
  }
}

function getCurrentMedicationCodes(bundle: Bundle): Set<string> {
  const rxNormCode = new Set<string>();

  bundle.entry?.forEach(({ resource }) => {
    if (!resource || !resource.id || resource.resourceType !== "Medication") return;
    const medication = resource as Medication;

    medication.code?.coding?.forEach(({ code, system }) => {
      if (!code || !system) return;
      if (system === RXNORM_URL) {
        rxNormCode.add(code);
      }
    });
  });

  return rxNormCode;
}
