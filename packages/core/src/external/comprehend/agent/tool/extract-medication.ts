import { AnthropicTool } from "../../../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "../../client";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";

export class ExtractMedicationTool extends AnthropicTool<ExtractTextRequest> {
  constructor(private readonly client: ComprehendClient) {
    super({
      name: "extractMedication",
      description: "Extract medication information from the provided medical text.",
      inputSchema: extractTextRequestSchema,
      handler: async input => {
        const result = await this.client.inferRxNorm(input.text);
        return result;
      },
    });
  }
}
