import _ from "lodash";
import { SNOMEDCTEntity } from "@aws-sdk/client-comprehendmedical";
import { Resource } from "@medplum/fhirtypes";
import { ComprehendClient } from "../client";
import { ComprehendContext } from "../types";

export async function inferSnomedCT(
  text: string,
  externalContext: ComprehendContext,
  {
    comprehendClient = new ComprehendClient(),
    confidenceThreshold = 0.1,
  }: { comprehendClient?: ComprehendClient; confidenceThreshold?: number } = {}
): Promise<Array<Resource>> {
  const response = await comprehendClient.inferSNOMEDCT(text);
  const context: ComprehendContext = {
    ...externalContext,
    originalText: text,
  };

  return getFhirResourcesFromSnomedEntities(response.Entities ?? [], {
    confidenceThreshold,
    context,
  });
}

export function getFhirResourcesFromSnomedEntities(
  entities: SNOMEDCTEntity[],
  { confidenceThreshold, context }: { confidenceThreshold: number; context: ComprehendContext }
): Array<Resource> {
  const resources: Array<Resource> = [];
  console.log(confidenceThreshold, context);

  for (const entity of entities) {
    console.log(entity);
  }

  return _(resources).compact().value();
}
