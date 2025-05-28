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

const displayCache = new Map<string, string | undefined>();
export async function lookupDisplay(
  client: TerminologyClient,
  system: string,
  code: string
): Promise<string | undefined> {
  const cacheKey = `${system}|${code}`;
  if (displayCache.has(cacheKey)) {
    return displayCache.get(cacheKey);
  }
  try {
    const parameters = createLookupParameters(system, code);
    const lookup = await client.lookupCode(parameters);
    const display = lookup[0]?.display;
    displayCache.set(cacheKey, display);
    return display;
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
