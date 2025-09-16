import type { ComprehendContext } from "../types";
import type { SpecializedAgent } from "./specialized-agent";

export type SpecializedAgentClass = {
  new (context: ComprehendContext): SpecializedAgent;
};

export interface SpecializedAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
}
