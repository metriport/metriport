import { ConceptMapTranslateParameters, normalizeOperationOutcome } from "@medplum/core";
import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import { ConceptMap, OperationDefinition, OperationOutcome, Parameters } from "@medplum/fhirtypes";
import z from "zod";
import { getTermServerClient } from "../init-term-server";
import { conceptMapTranslateOperationDefinition } from "./definitions/conceptMapTranslate";
import { parseBulkLookupInputParameters, parseInputParameters } from "./utils/parameters";

const operation: OperationDefinition = conceptMapTranslateOperationDefinition;
const translateParametersSchema = z.object({
  resourceType: z.literal("Parameters"),
  id: z.string().optional(),
  parameter: z.array(
    z.object({
      name: z.enum(["system", "code", "targetsystem"]),
      valueUri: z.string().optional(),
      valueCode: z.string().optional(),
    })
  ),
});

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

export async function bulkConceptMapTranslateHandler(
  request: FhirRequest
): Promise<
  { status: 200; data: { [k: string]: ConceptMap } } | { status: 400; data: OperationOutcome[] }
> {
  if (!Array.isArray(request.body)) {
    return {
      status: 400,
      data: [
        normalizeOperationOutcome(new Error("Input must be an array of Parameters resources")),
      ],
    };
  }

  const parametersArray = request.body;
  const invalidParams = parametersArray.flatMap((param, index) => {
    try {
      translateParametersSchema.parse(param);
      return [];
    } catch (error) {
      return normalizeOperationOutcome(new Error(`Invalid Parameters resource at index ${index}`));
    }
  });

  if (invalidParams.length > 0) {
    return {
      status: 400,
      data: invalidParams,
    };
  }

  const inputParams = parametersArray as Parameters[];

  const params = parseBulkLookupInputParameters(operation, inputParams);
  const startedAt = Date.now();

  const results = await Promise.allSettled(
    params.map(async param => {
      const conceptMap = await lookupConceptMap(param);
      return conceptMap;
    })
  );
  const successful = results
    .filter((result): result is PromiseFulfilledResult<ConceptMap> => {
      return result.status === "fulfilled";
    })
    .map(r => {
      return {
        ...r,
        status: undefined,
      };
    });

  const duration = Date.now() - startedAt;

  console.log(`Done code crosswalk for ${successful.length} concepts. Duration: ${duration} ms`);
  const crosswalkMap = new Map<string, ConceptMap>();

  successful.forEach(r => {
    const sourceCode = r.value.group?.[0].element?.[0]?.code;
    if (sourceCode) {
      crosswalkMap.set(sourceCode, r.value);
    }
  });

  return {
    status: 200,
    data: Object.fromEntries(crosswalkMap),
  };
}
