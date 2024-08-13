import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import { OperationDefinition, Coding, CodeSystem } from "@medplum/fhirtypes";
import { normalizeOperationOutcome, badRequest, TypedValue, notFound, append } from "@medplum/core";
import { codeLookupOperationDefinition } from "./definitions/codeLookupOperation";
import { parseInputParameters } from "./utils/parameters";
import { findCodeSystemResource } from "./utils/codeSystemLookup";
import { getTermServerClient } from "../sqlite";

const operation: OperationDefinition = codeLookupOperationDefinition;

type CodeSystemLookupParameters = {
  code?: string;
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
  request: FhirRequest
): Promise<CodeSystemLookupOutput | FhirResponse> => {
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
  return await lookupCoding(codeSystem, coding);
};

export async function lookupCoding(
  codeSystem: CodeSystem,
  coding: Coding
): Promise<CodeSystemLookupOutput | FhirResponse> {
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
      FROM Coding c
      INNER JOIN CodeSystem cs ON c.system = cs.id
      LEFT JOIN Coding_Property cp ON cp.coding = c.id
      LEFT JOIN CodeSystem_Property csp ON cp.property = csp.id
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

  return output;
}
