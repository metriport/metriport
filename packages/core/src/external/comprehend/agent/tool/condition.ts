import { AnthropicAgent } from "../../../bedrock/agent/anthropic";
import { AnthropicTool } from "../../../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "../../client";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";

export function buildComprehendConditionTool(client: ComprehendClient = new ComprehendClient()) {
  const conditionAgent = new ConditionAgent(client);

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
  constructor(private readonly client: ComprehendClient) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: `You are an agent that receives unstructured text containing condition information, along with FHIR resources that were extracted from the bundle.`,
    });
  }

  async extractConditions(text: string) {
    const result = await this.client.inferICD10CM(text);
    return result;
  }
}
