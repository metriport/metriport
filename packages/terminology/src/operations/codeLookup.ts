import { TypedValue, append, badRequest, normalizeOperationOutcome, notFound } from "@medplum/core";
import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import { CodeSystem, Coding, OperationDefinition } from "@medplum/fhirtypes";
import { getTermServerClient } from "../init-term-server";
import { codeLookupOperationDefinition } from "./definitions/codeLookupOperation";
import { findCodeSystemResource } from "./utils/codeSystemLookup";
import { parseBulkInputParameters, parseInputParameters } from "./utils/parameters";

const operation: OperationDefinition = codeLookupOperationDefinition;

type CodeSystemLookupParameters = {
  code?: string;
  id?: string;
  system?: string;
  version?: string;
  coding?: Coding;
  property?: string[];
};

export type CodeSystemLookupOutput = {
  name: string;
  display: string;
  code: string;
  property?: { code: string; description: string; value: TypedValue }[];
};

export const codeSystemLookupHandler = async (
  request: FhirRequest,
  partial: boolean
): Promise<CodeSystemLookupOutput[] | FhirResponse> => {
  const params = parseInputParameters<CodeSystemLookupParameters>(operation, request);
  if (!params.system) {
    return [normalizeOperationOutcome(new Error("System is Required"))];
  }
  const codeSystem = await findCodeSystemResource(params.system);
  let coding: Coding;
  if (params.coding) {
    coding = params.coding;
  } else if (params.code) {
    coding = { system: params.system ?? codeSystem.url, code: params.code };
  } else {
    return [badRequest("No coding specified")];
  }

  if (partial) {
    return await lookupPartialCoding(codeSystem, coding);
  } else {
    return await lookupCoding(codeSystem, coding);
  }
};

export async function bulkCodeSystemLookupHandler(request: FhirRequest) {
  const params = parseBulkInputParameters<CodeSystemLookupParameters>(operation, request);

  const startedAt = Date.now();
  const results = await Promise.allSettled(
    params.map(async param => {
      if (!param.system) {
        return [normalizeOperationOutcome(new Error("System is Required"))];
      }
      if (!param.id) {
        return [normalizeOperationOutcome(new Error("ID is required for bulk requests"))];
      }
      const codeSystem = await findCodeSystemResource(param.system);

      let coding: Coding;
      if (param.coding) {
        coding = param.coding;
      } else if (param.code) {
        coding = { system: param.system ?? codeSystem.url, code: param.code };
      } else {
        return [badRequest("No coding specified")];
      }

      const res = await lookupCoding(codeSystem, coding);
      return {
        ...res[0], // TODO: Make sure [0] is not harmful and we're not missing things..
        id: param.id,
      };
    })
  );

  const duration = Date.now() - startedAt;
  console.log(`Done code lookup. Duration: ${duration} ms`);

  const successful = results
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map(r => r.value);

  return successful;
}

export async function lookupPartialCoding(
  codeSystem: CodeSystem,
  coding: Coding
): Promise<CodeSystemLookupOutput[] | FhirResponse> {
  if (coding.system && coding.system !== codeSystem.url) {
    return [notFound];
  }

  const dbClient = getTermServerClient();

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

  const params = [codeSystem.id, `${coding.code}%`];
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
  if (coding.system && coding.system !== codeSystem.url) {
    return [notFound];
  }

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

  const params = [codeSystem.id, coding.code];
  const result = await dbClient.select(query, params);

  if (result.length === 0) {
    console.log(`Code not found: system=${codeSystem.url}, code=${coding.code}`);
    return [notFound];
  }

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
