import { z } from "zod";
import { AnthropicTool } from "../../bedrock/agent/anthropic/tool";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { AnthropicAgent } from "../../bedrock/agent/anthropic";
import { Config } from "../../../util/config";
import type { ComprehendContext } from "../types";
import { buildBundleEntry } from "../../fhir/bundle/bundle";

export abstract class SpecializedAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  private name: string;
  private description: string;
  private targetBundle?: Bundle;

  constructor({
    name,
    description,
    systemPrompt,
  }: {
    name: string;
    description: string;
    systemPrompt: string;
  }) {
    super({
      version: "claude-sonnet-3.7",
      region: Config.getBedrockRegion(),
      systemPrompt,
    });
    this.name = name;
    this.description = description;
  }

  /**
   * Implemented by the specialized agent for extracting FHIR resources from the unstructured text.
   * @param text - The unstructured text to extract FHIR resources from.
   * @param context - The context where the unstructured text appears (patient ID, encounter ID, original text, etc.)
   */
  abstract extractFhirResources(text: string, context: ComprehendContext): Promise<Resource[]>;

  /**
   * Returns a tool that is used by the orchestrator agent to call this specialized agent
   * to extract FHIR resources from the unstructured text.
   */
  getOrchestratorTool(context: ComprehendContext): AnthropicTool<{ text: string }, Resource[]> {
    return new AnthropicTool({
      name: this.name,
      description: this.description,
      inputSchema: z.object({
        text: z.string(),
      }),
      handler: async ({ text }) => {
        const resources = await this.extractFhirResources(text, context);
        if (this.targetBundle) {
          const bundleEntries = resources.map(resource => buildBundleEntry(resource));
          this.targetBundle.entry?.push(...bundleEntries);
        }
        return resources;
      },
    });
  }

  setTargetBundle(bundle: Bundle): void {
    this.targetBundle = bundle;
  }
}
