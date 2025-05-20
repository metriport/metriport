import { Parameters } from "@medplum/fhirtypes";
import { TerminologyClient } from "../client";

export async function sendParameters(
  parameters: Parameters,
  client: TerminologyClient
): Promise<void> {
  await client.importCode(parameters).catch(err => {
    console.error(
      "Error sending batch for system",
      parameters.parameter?.find(p => p.name === "system")?.valueUri,
      err.outcome?.issue
    );
    throw err;
  });
}
