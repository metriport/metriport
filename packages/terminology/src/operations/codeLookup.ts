import { TypedValue, append, normalizeOperationOutcome, notFound } from "@medplum/core";
import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import {
  CodeSystem,
  Coding,
  OperationDefinition,
  OperationOutcome,
  Parameters,
} from "@medplum/fhirtypes";
import { getTermServerClient } from "../init-term-server";
import { normalizeNdcCode } from "../util";
import { codeLookupOperationDefinition } from "./definitions/codeLookupOperation";
import { ndcCodeSystem } from "./definitions/codeSystem";
import { findCodeSystemResource } from "./utils/codeSystemLookup";
import {
  isValidLookupParametersResource,
  parseBulkLookupInputParameters,
  parseInputParameters,
} from "./utils/parameters";

const operation: OperationDefinition = codeLookupOperationDefinition;

export type CodeSystemLookupOutput = {
  id?: string | undefined;
  name: string;
  display: string;
  code: string;
  property?: { code: string; description: string; value: TypedValue }[];
};

/**
 * Normalize codes prior to lookup
 *
 * For NDC, remove dashes
 * For other systems, return the code as is
 */
function normalizeCode(code: string, system: string): string {
  if (system === ndcCodeSystem.url) {
    return normalizeNdcCode(code, true);
  }
  return code;
}

export const codeSystemLookupHandler = async (
  request: FhirRequest,
  partial: boolean
): Promise<CodeSystemLookupOutput[] | FhirResponse> => {
  const params = parseInputParameters(operation, request);

  if (!params.system) {
    return [normalizeOperationOutcome(new Error("System parameter is required"))];
  }

  const codeSystem = await findCodeSystemResource(params.system);
  let coding: Coding;
  if (params.coding) {
    coding = params.coding;
  } else if (params.code) {
    coding = { system: params.system ?? codeSystem.url, code: params.code };
  } else {
    return [normalizeOperationOutcome(new Error("Coding is Required"))];
  }

  if (partial) {
    return await lookupPartialCoding(codeSystem, coding);
  }

  return await lookupCoding(codeSystem, coding);
};

export async function bulkCodeSystemLookupHandler(request: FhirRequest): Promise<{
  status: 200 | 400;
  // TODO: 2599 - See if we can define a more FHIR-friendly return for the successful responses
  data: CodeSystemLookupOutput[] | OperationOutcome[];
}> {
  if (!Array.isArray(request.body)) {
    return {
      status: 400,
      data: [
        normalizeOperationOutcome(new Error("Input must be an array of Parameters resources")),
      ],
    };
  }

  const invalidParams = request.body.flatMap((param, index) => {
    if (isValidLookupParametersResource(param)) return [];
    return normalizeOperationOutcome(new Error(`Invalid Parameters resource at index ${index}`));
  });

  if (invalidParams.length > 0) {
    return {
      status: 400,
      data: invalidParams,
    };
  }

  const inputParams = request.body as Parameters[];
  const params = parseBulkLookupInputParameters(operation, inputParams);

  const startedAt = Date.now();
  const results = await Promise.allSettled(
    params.map(async param => {
      if (!param.system) {
        return normalizeOperationOutcome(new Error("System is Required"));
      }
      const codeSystem = await findCodeSystemResource(param.system);

      let coding: Coding;
      if (param.coding) {
        coding = param.coding;
      } else if (param.code) {
        coding = { system: param.system ?? codeSystem.url, code: param.code };
      } else {
        return normalizeOperationOutcome(new Error("Coding is Required"));
      }

      const lookupResult = await lookupCoding(codeSystem, coding);

      // TODO: 2599 - For cases like this, send back an OperationOutcome that would indicate an internal error and return status 500.
      if (!Array.isArray(lookupResult) || lookupResult.length === 0) {
        return normalizeOperationOutcome(new Error("Internal error during lookup"));
      }

      return {
        ...lookupResult[0],
        id: param.id,
      } as CodeSystemLookupOutput;
    })
  );

  const duration = Date.now() - startedAt;
  console.log(`Done code lookup. Duration: ${duration} ms`);

  const successful = results
    .filter((result): result is PromiseFulfilledResult<CodeSystemLookupOutput> => {
      return result.status === "fulfilled" && !("resourceType" in result.value);
    })
    .map(result => result.value);

  return {
    status: 200,
    data: successful,
  };
}

export async function lookupPartialCoding(
  codeSystem: CodeSystem,
  coding: Coding
): Promise<CodeSystemLookupOutput[] | FhirResponse> {
  const { code, system } = coding;
  if (!code || !system) return [notFound];

  if (system !== codeSystem.url) {
    return [notFound];
  }

  const dbClient = getTermServerClient();
  const normalizedCode = normalizeCode(code, system);

  const query = `
    SELECT 
      c.code,
      c.display,
      csp.code AS property_code,
      csp.type AS property_type,
      csp.description AS property_description,
      cp.value AS property_value
    FROM coding c
    INNER JOIN code_system cs ON c.system = cs.id
    LEFT JOIN coding_property cp ON cp.coding = c.id
    LEFT JOIN code_system_property csp ON cp.property = csp.id
    WHERE cs.id = ? AND c.code LIKE ?
  `;

  const params = [codeSystem.id, `${normalizedCode}%`];
  const result = await dbClient.select(query, params);

  if (result.length === 0) {
    console.log(`No codes found: system=${codeSystem.url}, partial code=${coding.code}`);
    return [notFound];
  }

  const output: CodeSystemLookupOutput[] = [];
  let currentCode = "";
  let currentOutput: CodeSystemLookupOutput | null = null;

  for (const row of result) {
    if (row.code !== currentCode) {
      if (currentOutput) {
        output.push(currentOutput);
      }
      currentCode = row.code;
      currentOutput = {
        name: codeSystem.name ?? "",
        code: row.code,
        display: row.display ?? "",
        property: [],
      };
    }

    if (currentOutput && row.property_code && row.property_value) {
      currentOutput.property?.push({
        code: row.property_code,
        description: row.property_description,
        value: { type: row.property_type, value: row.property_value },
      });
    }
  }

  if (currentOutput) {
    output.push(currentOutput);
  }

  return output;
}

export async function lookupCoding(
  codeSystem: CodeSystem,
  coding: Coding
): Promise<CodeSystemLookupOutput[] | FhirResponse> {
  const { code, system } = coding;
  if (!code || !system) return [notFound];

  if (system !== codeSystem.url) {
    return [notFound];
  }
  const normalizedCode = normalizeCode(code, system);

  const dbClient = getTermServerClient();

  const query = `
      SELECT 
        c.display,
        csp.code,
        csp.type,
        csp.description,
        cp.value
      FROM coding c
      INNER JOIN code_system cs ON c.system = cs.id
      LEFT JOIN coding_property cp ON cp.coding = c.id
      LEFT JOIN code_system_property csp ON cp.property = csp.id
      WHERE cs.id = ? AND c.code = ?
    `;

  const params = [codeSystem.id, normalizedCode];
  const result = await dbClient.select(query, params);

  if (result.length === 0) return [notFound];

  const resolved = result[0];
  const output: CodeSystemLookupOutput = {
    name: resolved.name,
    code: coding.code ?? "",
    display: resolved.display ?? "",
  };

  for (const property of result) {
    if (property.code && property.value) {
      output.property = append(output.property, {
        code: property.code,
        description: property.description,
        value: { type: property.type, value: property.value },
      });
    }
  }

  return [output];
}
