import { BedrockTool } from "../../../bedrock/agent/tool";
import { ExtractTextRequest, extractTextRequestSchema } from "./schema";

export class ExtractMedicationTool extends BedrockTool<ExtractTextRequest> {
  constructor() {
    super({
      name: "extractMedication",
      description: "Extract medication information from the provided medical text.",
      inputSchema: extractTextRequestSchema,
    });
  }

  async execute(input: ExtractTextRequest): Promise<unknown> {
    return {
      medication: "Medication information" + input.text,
    };
  }
}
