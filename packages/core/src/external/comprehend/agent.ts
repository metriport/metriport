import { z } from "zod";
import { Bundle } from "@medplum/fhirtypes";
import { AnthropicAgent } from "../bedrock/agent/anthropic";
import { AnthropicTool } from "../bedrock/agent/anthropic/tool";
import { ComprehendClient } from "./client";

const rxNormTool = new AnthropicTool({
  name: "rxNorm",
  description: "Infer RxNorm codes from text",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ codes: z.array(z.string()) }),
  handler: async input => {
    return { codes: [input.text] };
  },
});

export class ComprehendAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  private readonly comprehend: ComprehendClient;

  constructor({ comprehend = new ComprehendClient() }: { comprehend?: ComprehendClient }) {
    super({
      version: "claude-sonnet-3.7",
      region: "us-east-1",
      systemPrompt: "You are a helpful assistant that can infer FHIR resources from text.",
      maxTokens: 1024,
      tools: [rxNormTool],
    });
    this.comprehend = comprehend;
  }

  async inferFhir(text: string): Promise<Bundle> {
    console.log("inferFhir", text);
    console.log("comprehend", this.comprehend);
    return {
      resourceType: "Bundle",
      entry: [],
    };
  }
}
