import { Bundle } from "@medplum/fhirtypes";
import { buildBundle } from "../fhir/bundle/bundle";
import { OrchestratorAgent } from "./agent/agent";

export async function textToFHIR(text: string): Promise<Bundle> {
  const agent = new OrchestratorAgent();

  const response = await agent.startConversation(text);
  console.log("response", response);
  const bundle = buildBundle({ type: "collection" });
  return bundle;
}
