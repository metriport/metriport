import { Parameters } from "@medplum/fhirtypes";
import { TerminologyClient } from "../client";

export async function sendParameters(
  parameters: Parameters,
  client: TerminologyClient,
  isOverwrite?: boolean
): Promise<void> {
  await client.importCode(parameters, isOverwrite).catch(err => {
    console.error(
      "Error sending batch for system",
      parameters.parameter?.find(p => p.name === "system")?.valueUri,
      err.outcome?.issue
    );
    throw err;
  });
}

export async function lookupDisplay(
  client: TerminologyClient,
  system: string,
  code: string
): Promise<string | undefined> {
  try {
    const parameters = createLookupParameters(system, code);
    const lookup = await client.lookupCode(parameters);
    return lookup[0]?.display;
  } catch (error) {
    console.warn(`Could not lookup display for ${system}|${code}: ${error}`);
    return undefined;
  }
}

export function createLookupParameters(system: string, code: string): Parameters {
  return {
    resourceType: "Parameters",
    parameter: [
      { name: "system", valueUri: system },
      { name: "code", valueCode: code },
    ],
  };
}
