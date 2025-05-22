import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import { OperationDefinition, ConceptMap } from "@medplum/fhirtypes";
import { ConceptMapTranslateParameters, normalizeOperationOutcome } from "@medplum/core";
import { conceptMapTranslateOperationDefinition } from "./definitions/conceptMapTranslate";
import { parseInputParameters } from "./utils/parameters";
import { getTermServerClient } from "../init-term-server";

const operation: OperationDefinition = conceptMapTranslateOperationDefinition;

export async function conceptMapTranslateHandler(
  req: FhirRequest
): Promise<FhirResponse | ConceptMap> {
  try {
    const params = parseInputParameters(operation, req);
    return await lookupConceptMap(params);
  } catch (error) {
    return [normalizeOperationOutcome(error)];
  }
}

async function lookupConceptMap(params: ConceptMapTranslateParameters): Promise<ConceptMap> {
  const dbClient = getTermServerClient();
  const query =
    'SELECT * FROM "concept_map" WHERE "source" = ? AND "sourceCode" = ? AND "target" = ?';
  const result = await dbClient.selectOne(query, [params.system, params.code, params.targetsystem]);
  return JSON.parse(result.content);
}
