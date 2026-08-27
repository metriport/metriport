import { errorToString } from "@metriport/shared";
import { CodeSystem } from "@medplum/fhirtypes";
import { getTermServerClient } from "../../init-term-server";
import { out } from "../../log";

export const parentProperty = "http://hl7.org/fhir/concept-properties#parent";
export const childProperty = "http://hl7.org/fhir/concept-properties#child";
export const abstractProperty = "http://hl7.org/fhir/concept-properties#notSelectable";

export async function findCodeSystemResource(system: string): Promise<CodeSystem> {
  const { log } = out("findCodeSystemResource");
  const query = 'SELECT * FROM "code_system" WHERE "system" = ?';
  const params = [system];

  try {
    const dbClient = getTermServerClient();
    const result = await dbClient.selectOne(query, params);
    if (!result) {
      throw new Error(`CodeSystem with system '${system}' not found`);
    }
    return JSON.parse(result.content);
  } catch (error) {
    log(`Error finding CodeSystem resource: ${errorToString(error)}`);
    throw error;
  }
}
