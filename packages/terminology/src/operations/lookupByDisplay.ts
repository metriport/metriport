import { TypedValue, append, normalizeOperationOutcome } from "@medplum/core";
import { FhirRequest } from "@medplum/fhir-router";
import { CodeSystem, OperationDefinition, OperationOutcome } from "@medplum/fhirtypes";
import { getTermServerClient } from "../init-term-server";
import { lookupByDisplayOperationDefinition } from "./definitions/lookupByDisplayOperation";
import { findCodeSystemResource } from "./utils/codeSystemLookup";
import { parseInputParameters } from "./utils/parameters";

const operation: OperationDefinition = lookupByDisplayOperationDefinition;

export type LookupByDisplayOutput = {
  name: string;
  display: string;
  code: string;
  property?: { code: string; description: string; value: TypedValue }[];
};

/**
 * Look up a code by display text within a target code system.
 * E.g. display "hyperlipidemia" in system ICD-10-CM returns matching code(s).
 */
export async function lookupByDisplayCoding(
  codeSystem: CodeSystem,
  display: string
): Promise<LookupByDisplayOutput[]> {
  if (!display?.trim()) return [];

  const dbClient = getTermServerClient();
  const normalizedDisplay = display.trim().toLowerCase();

  /**
   * !!!WARNING!!!
   * This approach is fitting for ICD-10-CM lookups, and has not been tested (and likely won't work) for other code systems.
   *
   * The current approach is to look for the exact display match first, then look for a display that starts with the exact display and ends with ' unspecified'.
   * This is to handle the case where the display is not exact, but is close enough to be considered a match.
   * From the potential matches, we then choose the shortest code because ICD-10 is a hierarchical code system, and we don't want to return results more specific than the display.
   */
  const query = `
    SELECT
      c.id AS coding_id,
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
    WHERE cs.id = ? AND LOWER(c.display) LIKE ?
    ORDER BY
      (LOWER(c.display) = LOWER(?)) DESC,
      (LOWER(c.display) LIKE LOWER(? || ', unspecified%')) DESC,
      LENGTH(c.code) ASC,
      c.id
  `;

  const params = [codeSystem.id, `${normalizedDisplay}%`, normalizedDisplay, normalizedDisplay];
  const result = await dbClient.select(query, params);

  if (result.length === 0) return [];

  const firstRow = result[0];
  const bestCodingId = firstRow.coding_id;
  const output: LookupByDisplayOutput = {
    name: codeSystem.name ?? "",
    code: firstRow.code ?? "",
    display: firstRow.display ?? "",
  };

  for (const property of result) {
    if (property.coding_id !== bestCodingId) continue;
    if (property.property_code && property.property_value) {
      output.property = append(output.property, {
        code: property.property_code,
        description: property.property_description,
        value: { type: property.property_type, value: property.property_value },
      });
    }
  }

  return [output];
}

export async function lookupByDisplayHandler(request: FhirRequest): Promise<{
  status: 200 | 400;
  data: LookupByDisplayOutput | OperationOutcome;
}> {
  const params = parseInputParameters(operation, request);

  if (!params.system) {
    return {
      status: 400,
      data: normalizeOperationOutcome(new Error("System parameter is required")),
    };
  }

  if (!params.display) {
    return {
      status: 400,
      data: normalizeOperationOutcome(new Error("Display parameter is required")),
    };
  }

  try {
    const codeSystem = await findCodeSystemResource(params.system);
    const lookupResult = await lookupByDisplayCoding(codeSystem, params.display);

    if (lookupResult.length < 1) {
      return {
        status: 400,
        data: normalizeOperationOutcome(
          new Error(
            `No matching code found for display "${params.display}" in system ${params.system}`
          )
        ),
      };
    }

    return {
      status: 200,
      data: lookupResult[0],
    };
  } catch (err) {
    return {
      status: 400,
      data: normalizeOperationOutcome(err),
    };
  }
}
