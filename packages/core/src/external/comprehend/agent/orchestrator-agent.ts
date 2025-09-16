import { Bundle } from "@medplum/fhirtypes";
import { Config } from "../../../util/config";
import { AnthropicAgent } from "../../bedrock/agent/anthropic";
import { ORCHESTRATOR_PROMPT } from "./prompts";
import type { ComprehendContext } from "../types";
import { RxNormAgent } from "./rxnorm-agent";
import { buildBundle } from "../../fhir/bundle/bundle";
import type { SpecializedAgent } from "./specialized-agent";

/**
 * The orchestrator agent is responsible for passing relevant medical text from a piece of clinical text to the appropriate extraction agent.
 * It is restricted to operating within a specific context (i.e. a single diagnostic report or encounter summary), so a new instance of this
 * agent must be instantiated for each separate context that data extraction is required for.
 */
export class OrchestratorAgent extends AnthropicAgent<"claude-sonnet-3.7"> {
  // private context: ComprehendContext;
  private specializedAgents: SpecializedAgent[];

  constructor(context: ComprehendContext) {
    super({
      version: "claude-sonnet-3.7",
      region: Config.getBedrockRegion(),
      systemPrompt: ORCHESTRATOR_PROMPT,
      tools: [new RxNormAgent().getOrchestratorTool(context)],
      maxTokens: 10000,
    });

    // this.context = context;
    this.specializedAgents = [new RxNormAgent()];
    for (const specializedAgent of this.specializedAgents) {
      this.addTool(specializedAgent.getOrchestratorTool(context));
    }
  }

  async extractFhirBundle(text: string): Promise<Bundle> {
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

    return resultBundle;
  }
}
