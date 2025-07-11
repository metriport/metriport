import { Bundle, Condition } from "@medplum/fhirtypes";
import { ICD_10_URL } from "../../../../util/constants";
import { AnthropicAgent } from "../../../bedrock/agent/anthropic";
import { AnthropicTool } from "../../../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "../../client";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";

export function buildComprehendConditionTool(
  bundle: Bundle,
  client: ComprehendClient = new ComprehendClient()
) {
  const conditionAgent = new ConditionAgent(bundle, client);

  async function conditionToolHandler(input: ExtractTextRequest) {
    const result = await conditionAgent.extractConditions(input.text);
    return result;
  }

  return new AnthropicTool({
    name: "comprehendConditions",
    description: "Extracts Condition FHIR resources from the medical text with ICD-10-CM codes.",
    inputSchema: extractTextRequestSchema,
    handler: conditionToolHandler,
  });
}

export class ConditionAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  private readonly currentICD10Codes: Set<string>;

  constructor(bundle: Bundle, private readonly client: ComprehendClient) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: `You are an agent that receives unstructured text containing condition information, along with FHIR resources that were extracted from the bundle.`,
    });
    this.currentICD10Codes = getCurrentConditionCodes(bundle);
  }

  async extractConditions(text: string) {
    const result = await this.client.inferICD10CM(text);
    if (this.currentICD10Codes.size > 0) {
      result.Entities?.filter(({ Score }) => Score && Score > 0.5);
    }
    return result;
  }
}

function getCurrentConditionCodes(bundle: Bundle): Set<string> {
  const icd10 = new Set<string>();

  bundle.entry?.forEach(({ resource }) => {
    if (!resource || !resource.id || resource.resourceType !== "Condition") return;
    const condition = resource as Condition;

    condition.code?.coding?.forEach(({ code, system }) => {
      if (!code || !system) return;
      if (system === ICD_10_URL) {
        icd10.add(code);
      }
    });
  });

  return icd10;
}
