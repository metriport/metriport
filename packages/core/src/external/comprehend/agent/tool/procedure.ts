import { Bundle, Procedure } from "@medplum/fhirtypes";
import { AnthropicAgent } from "../../../bedrock/agent/anthropic";
import { AnthropicTool } from "../../../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "../../client";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";
import { ICD_10_URL } from "../../../../util/constants";

export function buildComprehendProcedureTool(
  bundle: Bundle,
  client: ComprehendClient = new ComprehendClient()
) {
  const procedureAgent = new ComprehendProcedureAgent(bundle, client);

  async function procedureToolHandler(input: ExtractTextRequest) {
    const result = await procedureAgent.extractProcedures(input.text);
    return result;
  }

  return new AnthropicTool({
    name: "comprehendProcedures",
    description: "Extracts Procedure FHIR resources from the medical text with ICD-10-CM codes.",
    inputSchema: extractTextRequestSchema,
    handler: procedureToolHandler,
  });
}

export class ComprehendProcedureAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  private readonly currentICD10Codes: Set<string>;
  private readonly client: ComprehendClient;

  constructor(bundle: Bundle, client: ComprehendClient = new ComprehendClient()) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: `You are an agent that receives unstructured text containing procedure information, along with FHIR resources that were extracted from the bundle.`,
    });
    this.client = client;
    this.currentICD10Codes = getCurrentProcedureCodes(bundle);
  }

  async extractProcedures(text: string) {
    const result = await this.client.inferICD10CM(text);
    if (this.currentICD10Codes.size > 0) {
      result.Entities?.filter(({ Score }) => Score && Score > 0.5);
    }
    return result;
  }
}

function getCurrentProcedureCodes(bundle: Bundle): Set<string> {
  const icd10 = new Set<string>();

  bundle.entry?.forEach(({ resource }) => {
    if (!resource || !resource.id || resource.resourceType !== "Procedure") return;
    const procedure = resource as Procedure;

    procedure.code?.coding?.forEach(({ code, system }) => {
      if (!code || !system) return;
      if (system === ICD_10_URL) {
        icd10.add(code);
      }
    });
  });

  return icd10;
}
