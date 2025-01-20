import { CodeSystem } from "@medplum/fhirtypes";
import { getTermServerClient } from "../../init-term-server";

export const parentProperty = "http://hl7.org/fhir/concept-properties#parent";
export const childProperty = "http://hl7.org/fhir/concept-properties#child";
export const abstractProperty = "http://hl7.org/fhir/concept-properties#notSelectable";

export async function findCodeSystemResource(system: string): Promise<CodeSystem> {
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
    console.log(`Error finding CodeSystem resource: ${error}`);
    throw error;
  }
}
