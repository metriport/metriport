import { RXNORM_AGENT_PROMPT } from "../prompts";
import { Resource } from "@medplum/fhirtypes";
import { SpecializedAgent } from "../specialized-agent";
import type { ComprehendContext } from "../../types";
import { inferMedications } from "../../rxnorm/fhir-converter";

export class RxNormAgent extends SpecializedAgent {
  constructor() {
    super({
      name: "inferRxNorm",
      description:
        "Extract FHIR Medication and MedicationStatement resources from the medical text with RxNorm codes",
      systemPrompt: RXNORM_AGENT_PROMPT,
    });
  }

  async extractFhirResources(text: string, context: ComprehendContext): Promise<Resource[]> {
    const medicationResources = await inferMedications(text, context);
    return medicationResources;
  }
}
