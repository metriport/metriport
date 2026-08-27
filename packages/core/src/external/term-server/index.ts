import { TypedValue } from "@medplum/core";
import { Coding, ConceptMap, Parameters, ParametersParameter } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { trimWhitespace } from "@metriport/shared/common/string";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../util/config";
import {
  CPT_URL,
  CVX_URL,
  ICD_10_URL,
  LOINC_URL,
  NDC_URL,
  RXNORM_URL,
  SNOMED_URL,
} from "../../util/constants";
import { buildMappingExtension } from "../fhir/shared/extensions/mapping-extension";
import { out } from "../../util";

export type CodeSystemLookupOutput = {
  name: string;
  id: string;
  display: string;
  code: string;
  property?: { code: string; description: string; value: TypedValue }[];
};

export const termServerUrl = Config.getTermServerUrl();
const bulkLookupByCodeUrl = "code-system/lookup/bulk";
const lookupByDisplayUrl = "code-system/lookup-by-display";
const crosswalkUrl = "concept-map/translate";

export const supportedSystems = [
  ICD_10_URL,
  SNOMED_URL,
  LOINC_URL,
  RXNORM_URL,
  CPT_URL,
  CVX_URL,
  NDC_URL,
];

export function isSystemValid(system: string) {
  const trimmedSystem = system.trim();
  if (supportedSystems.includes(trimmedSystem)) return true;
  return false;
}

export function buildTermServerApi(): AxiosInstance | undefined {
  if (!termServerUrl) return undefined;

  return axios.create({
    baseURL: termServerUrl,
    timeout: 15_000,
    transitional: {
      clarifyTimeoutError: true,
    },
  });
}

export async function lookupByCode(
  params: Parameters[]
): Promise<
  { metadata: Record<string, string | number>; data: CodeSystemLookupOutput[] } | undefined
> {
  const termServer = buildTermServerApi();
  if (!termServer || params.length === 0) return;

  const startedAt = Date.now();
  const result = await termServer.post(bulkLookupByCodeUrl, params);
  const duration = Date.now() - startedAt;

  const data = result.data.filter(
    (d: { resourceType?: string }) => d.resourceType !== "OperationOutcome"
  ) as CodeSystemLookupOutput[];

  const metadata = {
    numParams: params.length,
    numFound: data.length,
    lookupDuration: duration,
  };

  return { metadata, data };
}

export async function lookupByDisplay({
  display,
  system,
}: {
  display: string;
  system: string;
}): Promise<Coding | undefined> {
  const termServer = buildTermServerApi();
  if (!termServer) return undefined;

  const params = buildFhirParametersForLookupByDisplay({ display, system });
  if (!params) return undefined;

  try {
    const result = await executeWithNetworkRetries(async function () {
      return termServer.post(lookupByDisplayUrl, params);
    });

    const data = result.data;
    if (!data || data.resourceType === "OperationOutcome") return undefined;

    if (!data.code) return undefined;

    return {
      system,
      code: data.code,
      ...(data.display ? { display: data.display } : undefined),
    };
  } catch (error) {
    const { log } = out(`lookupByDisplay`);
    log(`tried to lookup: ${display}, system: ${system}`);
    return undefined;
  }
}

export async function crosswalkCode({
  sourceCode,
  sourceSystem,
  targetSystem,
}: {
  sourceCode: string;
  sourceSystem: string;
  targetSystem: string;
}): Promise<Coding | undefined> {
  const termServer = buildTermServerApi();
  if (!termServer) return undefined;

  const params = buildFhirParametersForCrosswalkFromCoding(
    {
      system: sourceSystem,
      code: sourceCode,
    },
    targetSystem
  );
  if (!params) return undefined;
  const result = await executeWithNetworkRetries(async function () {
    return termServer.post(crosswalkUrl, params);
  });

  const data = result.data.response as ConceptMap;
  const group = data.group?.[0];
  if (!group) return undefined;
  const element = group.element?.[0];
  if (!element) return undefined;
  const target = element.target?.[0];
  if (!target || !target.code) return undefined;

  const mappingExtension = buildMappingExtension({
    sourceSystem,
  });

  return {
    system: targetSystem,
    code: target.code,
    ...(target.display ? { display: target.display } : undefined),
    extension: [mappingExtension],
  };
}

export function buildMultipleFhirParametersFromCodings(
  codings: Coding[] | undefined
): Parameters[] | undefined {
  return codings?.flatMap(coding => buildFhirParametersFromCoding(coding) || []);
}

export function buildFhirParametersFromCoding(coding: Coding): Parameters | undefined {
  const code = trimWhitespace(coding.code);
  const system = trimWhitespace(coding.system);
  if (!code || !system) return undefined;

  const isValidSystem = isSystemValid(system);
  if (!isValidSystem) return undefined;

  const parameter: ParametersParameter[] = [
    {
      name: "system",
      valueUri: system,
    },
    {
      name: "code",
      valueCode: code,
    },
  ];

  return {
    resourceType: "Parameters",
    parameter,
    id: createUuidFromText(JSON.stringify(parameter)),
  };
}

export function buildFhirParametersForLookupByDisplay({
  display,
  system,
}: {
  display: string;
  system: string;
}): Parameters | undefined {
  const trimmedDisplay = trimWhitespace(display);
  if (!trimmedDisplay) return undefined;

  const trimmedSystem = trimWhitespace(system);
  if (!trimmedSystem || !isSystemValid(trimmedSystem)) return undefined;

  const parameter: ParametersParameter[] = [
    { name: "display", valueString: trimmedDisplay },
    { name: "system", valueUri: trimmedSystem },
  ];

  return {
    resourceType: "Parameters",
    parameter,
    id: createUuidFromText(JSON.stringify(parameter)),
  };
}

export function buildFhirParametersForCrosswalkFromCoding(
  coding: Coding,
  targetSystem: string
): Parameters | undefined {
  const code = trimWhitespace(coding.code);
  const system = trimWhitespace(coding.system);
  if (!code || !system) return undefined;

  const isValidSystem = isSystemValid(system);
  const isValidTargetSystem = isSystemValid(targetSystem);
  if (!isValidSystem || !isValidTargetSystem) return undefined;

  const parameter: ParametersParameter[] = [
    {
      name: "system",
      valueUri: system,
    },
    {
      name: "code",
      valueCode: code,
    },
    {
      name: "targetsystem",
      valueUri: targetSystem,
    },
  ];

  return {
    resourceType: "Parameters",
    parameter,
    id: createUuidFromText(JSON.stringify(parameter)),
  };
}
