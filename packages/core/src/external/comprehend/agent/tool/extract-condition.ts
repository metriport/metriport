import { AgentTool } from "../../../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "../../client";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";

export class ExtractConditionTool extends AgentTool<ExtractTextRequest> {
  constructor(private readonly client: ComprehendClient) {
    super({
      name: "extractCondition",
      description: "Extracts Condition FHIR resources from the medical text with ICD-10-CM codes.",
      inputSchema: extractTextRequestSchema,
    });
  }

  async execute(input: ExtractTextRequest): Promise<unknown> {
    const result = await this.client.inferICD10CM(input.text);
    return result;
  }
}
