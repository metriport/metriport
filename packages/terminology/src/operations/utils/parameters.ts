// Licensed under Apache. See LICENSE-APACHE in the repo root for license information.
import {
  OperationOutcomeError,
  badRequest,
  capitalize,
  isEmpty,
  isResource,
  validateResource,
} from "@medplum/core";
import { FhirRequest } from "@medplum/fhir-router";
import {
  Coding,
  OperationDefinition,
  OperationDefinitionParameter,
  Parameters,
  ParametersParameter,
} from "@medplum/fhirtypes";
import { Request } from "express";

export type CodeSystemLookupParameters = {
  code?: string;
  id?: string;
  system?: string;
  version?: string;
  coding?: Coding;
  property?: string[];
};

export type ConceptMapTranslateParameters = {
  code?: string;
  id?: string;
  system?: string;
  version?: string;
  coding?: Coding;
  property?: string[];
};

export function parseParameters<T>(input: T | Parameters): T {
  if (
    input &&
    typeof input === "object" &&
    "resourceType" in input &&
    input.resourceType === "Parameters"
  ) {
    const parameters = (input as Parameters).parameter ?? [];
    return Object.fromEntries(parameters.map(p => [p.name, p.valueString])) as T;
  } else {
    return input as T;
  }
}

/**
 * Parse an incoming Operation request and extract the defined input parameters into a dictionary object.
 *
 * @param operation - The Operation for which the request is intended.
 * @param req - The incoming request.
 * @returns A dictionary of parameter names to values.
 */
export function parseInputParameters(
  operation: OperationDefinition,
  req: Request | FhirRequest
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  if (!operation.parameter) return {};
  const inputParameters = operation.parameter.filter(p => p.use === "in");

  // TODO: 2599 - we should be able to always send the data in the body and simplify this code
  const input = req.method === "GET" ? parseQueryString(req.query, inputParameters) : req.body;

  if (input.resourceType === "Parameters") {
    if (!input.parameter) {
      return {};
    }
    return parseParams(inputParameters, input.parameter);
  } else {
    return Object.fromEntries(
      inputParameters.map(param => [
        param.name,
        validateInputParam(param, input[param.name as string]),
      ])
    );
  }
}

export function parseBulkLookupInputParameters(
  operation: OperationDefinition,
  parameters: Parameters[]
): CodeSystemLookupParameters[] {
  if (!operation.parameter) return [];

  const inputParameters = operation.parameter.filter(p => p.use === "in");

  const params: CodeSystemLookupParameters[] = [];
  parameters.forEach(param => {
    if (!param.parameter) return;
    params.push(parseParams(inputParameters, param.parameter, param.id));
  });
  return params;
}

function parseQueryString(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: Record<string, any>,
  inputParams: OperationDefinitionParameter[]
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  const parsed = Object.create(null);
  for (const param of inputParams) {
    if (!param.name) {
      continue;
    }
    const value = query[param.name];
    if (!value) {
      continue;
    }
    if (param.part || param.type?.match(/^[A-Z]/)) {
      // Query parameters cannot contain complex types
      throw new OperationOutcomeError(
        badRequest(
          `Complex parameter ${param.name} (${param.type}) cannot be passed via query string`
        )
      );
    }

    switch (param.type) {
      case "integer":
      case "positiveInt":
      case "unsignedInt": {
        const n = parseInt(value, 10);
        if (isNaN(n)) {
          throw new OperationOutcomeError(
            badRequest(`Invalid value '${value}' provided for ${param.type} parameter`)
          );
        }
        parsed[param.name] = n;
        break;
      }
      case "decimal": {
        const n = parseFloat(value);
        if (isNaN(n)) {
          throw new OperationOutcomeError(
            badRequest(`Invalid value '${value}' provided for ${param.type} parameter`)
          );
        }
        parsed[param.name] = n;
        break;
      }
      case "boolean":
        if (value === "true") {
          parsed[param.name] = true;
        } else if (value === "false") {
          parsed[param.name] = false;
        } else {
          throw new OperationOutcomeError(
            badRequest(`Invalid value '${value}' provided for ${param.type} parameter`)
          );
        }
        break;
      default:
        parsed[param.name] = value;
    }
  }
  return parsed;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateInputParam(param: OperationDefinitionParameter, value: any): any {
  // Check parameter cardinality (min and max)
  const min = param.min ?? 0;
  const max = parseInt(param.max ?? "1", 10);
  if (Array.isArray(value)) {
    if (value.length < min || value.length > max) {
      throw new OperationOutcomeError(
        badRequest(
          `Expected ${min === max ? max : min + ".." + max} value(s) for input parameter ${
            param.name
          }, but ${value.length} provided`
        )
      );
    }
  } else if (min > 0 && isEmpty(value)) {
    throw new OperationOutcomeError(
      badRequest(`Expected at least ${min} value(s) for required input parameter '${param.name}'`)
    );
  }

  return Array.isArray(value) && max === 1 ? value[0] : value;
}

function parseParams(
  params: OperationDefinitionParameter[],
  inputParameters: ParametersParameter[],
  id?: string
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: Record<string, any> = Object.create(null);

  for (const param of params) {
    // FHIR spec-compliant case: Parameters resource e.g.
    // { resourceType: 'Parameters', parameter: [{ name: 'message', valueString: 'Hello!' }] }
    const inParams = inputParameters.filter(p => p.name === param.name);

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any;
    if (param.part?.length) {
      value = inParams.map(input => parseParams(param.part as [], input.part ?? []));
    } else {
      value = inParams?.map(
        v => v[("value" + capitalize(param.type ?? "string")) as keyof ParametersParameter]
      );
    }

    parsed[param.name as string] = validateInputParam(param, value);
    if (id) parsed.id = id;
  }

  return parsed;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildOutputParameters(operation: OperationDefinition, output: any): Parameters {
  const outputParameters = operation.parameter?.filter(p => p.use === "out");
  const param1 = outputParameters?.[0];
  if (outputParameters?.length === 1 && param1 && param1.name === "return") {
    const isRes = !isResource(output);
    const equals = param1.type && output.resourceType !== param1.type;
    if (isRes || equals) {
      throw new Error(
        `Expected ${param1.type ?? "Resource"} output, but got unexpected ${typeof output}`
      );
    } else {
      // Send Resource as output directly, instead of using Parameters format
      return output as Parameters;
    }
  }
  const response: Parameters = {
    resourceType: "Parameters",
  };
  if (!outputParameters?.length) {
    // Send empty Parameters as response
    return response;
  }

  response.parameter = [];
  for (const param of outputParameters) {
    const key = param.name ?? "";
    const value = output[key];
    const count = Array.isArray(value) ? value.length : +(value !== undefined);

    if (param.min && param.min > 0 && count < param.min) {
      throw new Error(
        `Expected ${param.min} or more values for output parameter '${key}', got ${count}`
      );
    } else if (param.max && param.max !== "*" && count > parseInt(param.max, 10)) {
      throw new Error(
        `Expected at most ${param.max} values for output parameter '${key}', got ${count}`
      );
    } else if (isEmpty(value)) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const val of value.map(v => makeParameter(param, v))) {
        if (val) {
          response.parameter.push(val);
        }
      }
    } else {
      const val = makeParameter(param, value);
      if (val) {
        response.parameter.push(val);
      }
    }
  }

  validateResource(response);
  return response;
}

function makeParameter(
  param: OperationDefinitionParameter,
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
): ParametersParameter | undefined {
  if (param.part) {
    const parts: ParametersParameter[] = [];
    for (const part of param.part) {
      const nestedValue = value[part.name ?? ""];
      if (nestedValue !== undefined) {
        const nestedParam = makeParameter(part, nestedValue);
        if (nestedParam) {
          parts.push(nestedParam);
        }
      }
    }
    return { name: param.name, part: parts };
  }
  const type =
    param.type && param.type !== "Element"
      ? [param.type]
      : param.extension
          ?.filter(
            e =>
              e.url === "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type"
          )
          ?.map(e => e.valueUri as string);
  if (type?.length === 1) {
    return { name: param.name, ["value" + capitalize(type[0] as string)]: value };
  } else if (typeof value.type === "string" && value.value && type?.length) {
    // Handle TypedValue
    for (const t of type) {
      if (value.type === t) {
        return { name: param.name, ["value" + capitalize(t)]: value.value };
      }
    }
  }
  return undefined;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function isValidParameter(parameter: unknown): boolean {
  if (typeof parameter !== "object" || parameter === null || !("name" in parameter)) return false;
  const { name, valueUri, valueCode } = parameter as ParametersParameter;
  return (
    typeof name === "string" &&
    ((name === "system" && typeof valueUri === "string") ||
      (name === "code" && typeof valueCode === "string"))
  );
}

export function isValidLookupParametersResource(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null || !("resourceType" in obj)) return false;

  const { id, resourceType, parameter } = obj as Parameters;
  if (typeof id !== "string" || resourceType !== "Parameters" || !Array.isArray(parameter)) {
    return false;
  }

  const hasValidParameters =
    parameter.length > 0 &&
    parameter.some(p => isValidParameter(p) && p.name === "system") &&
    parameter.some(p => isValidParameter(p) && p.name === "code");

  return hasValidParameters;
}

export function isValidTranslateParametersResource(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null || !("resourceType" in obj)) return false;

  const { id, resourceType, parameter } = obj as Parameters;
  if (typeof id !== "string" || resourceType !== "Parameters" || !Array.isArray(parameter)) {
    return false;
  }

  const hasValidParameters =
    parameter.length > 0 &&
    parameter.some(p => isValidParameter(p) && p.name === "system") &&
    parameter.some(p => isValidParameter(p) && p.name === "code") &&
    parameter.some(p => isValidParameter(p) && p.name === "targetsystem");

  return hasValidParameters;
}

export function parseBulkTranslateInputParameters(
  operation: OperationDefinition,
  parameters: Parameters[]
): CodeSystemLookupParameters[] {
  if (!operation.parameter) return [];

  const inputParameters = operation.parameter.filter(p => p.use === "in");

  const params: CodeSystemLookupParameters[] = [];
  parameters.forEach(param => {
    if (!param.parameter) return;
    params.push(parseParams(inputParameters, param.parameter, param.id));
  });
  return params;
}
