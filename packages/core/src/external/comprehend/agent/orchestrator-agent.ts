import { Bundle } from "@medplum/fhirtypes";
import { Config } from "../../../util/config";
import { AnthropicAgent } from "../../bedrock/agent/anthropic";
import { ORCHESTRATOR_PROMPT } from "./prompts";
import type { ComprehendContext } from "../types";
import { RxNormAgent } from "./specialized/rxnorm-agent";
import { buildBundle } from "../../fhir/bundle/bundle";
import type { SpecializedAgent } from "./specialized-agent";
import { COMPREHEND_AGENT_VERSION } from "./types";

/**
 * The orchestrator agent is responsible for passing relevant medical text from a piece of clinical text to the appropriate extraction agent.
 * It is restricted to operating within a specific context (i.e. a single diagnostic report or encounter summary), so a new instance of this
 * agent must be instantiated for each separate context that data extraction is required for.
 */
export class OrchestratorAgent extends AnthropicAgent<typeof COMPREHEND_AGENT_VERSION> {
  // private context: ComprehendContext;
  private specializedAgents: SpecializedAgent[];

  constructor(context: ComprehendContext, specializedAgents?: SpecializedAgent[]) {
    super({
      version: COMPREHEND_AGENT_VERSION,
      region: Config.getBedrockRegion(),
      systemPrompt: ORCHESTRATOR_PROMPT,
      maxTokens: 10000,
    });

    // this.context = context;
    this.specializedAgents = specializedAgents ?? [new RxNormAgent()];
    for (const specializedAgent of this.specializedAgents) {
      this.addTool(specializedAgent.getOrchestratorTool(context));
    }
    console.log(`Orchestrator agent initialized with version ${COMPREHEND_AGENT_VERSION}`);
  }

  /**
   * Extracts FHIR resources from the unstructured text.
   * @param text - The unstructured text to extract FHIR resources from.
   * @returns A bundle of FHIR resources extracted from the unstructured text.
   */
  async extractFhirBundle(text: string): Promise<Bundle> {
    console.log(`Extracting FHIR bundle with version ${COMPREHEND_AGENT_VERSION}`);
    const resultBundle = buildBundle({ type: "collection", entries: [] });
    for (const specializedAgent of this.specializedAgents) {
      specializedAgent.setTargetBundle(resultBundle);
    }

    let response = await this.startConversation(text);
    if (!this.shouldExecuteTools(response)) return resultBundle;

    do {
      await this.executeTools(response);
      response = await this.continueConversation();
    } while (this.shouldExecuteTools(response));

    console.log("Done extracting FHIR bundle");
    return resultBundle;
  }
}
