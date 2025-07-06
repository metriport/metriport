import { BedrockTool } from "../../../bedrock/agent/tool";
import { ComprehendClient } from "../../client";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";

export class ExtractMedicationTool extends BedrockTool<ExtractTextRequest> {
  constructor(private readonly client: ComprehendClient) {
    super({
      name: "extractMedication",
      description: "Extract medication information from the provided medical text.",
      inputSchema: extractTextRequestSchema,
    });
  }

  async execute(input: ExtractTextRequest): Promise<unknown> {
    const result = await this.client.inferRxNorm(input.text);
    return result;
  }
}
