import { TypedValue } from "@medplum/core";
import { Coding, Parameters, ParametersParameter } from "@medplum/fhirtypes";
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

export type CodeSystemLookupOutput = {
  name: string;
  id: string;
  display: string;
  code: string;
  property?: { code: string; description: string; value: TypedValue }[];
};

export const termServerUrl = Config.getTermServerUrl();
const bulkLookupUrl = "code-system/lookup/bulk";

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
    timeout: 10_000,
    transitional: {
      clarifyTimeoutError: true,
    },
  });
}

export async function lookupMultipleCodes(
  params: Parameters[],
  log: typeof console.log
): Promise<
  { metadata: Record<string, string | number>; data: CodeSystemLookupOutput[] } | undefined
> {
  const termServer = buildTermServerApi();
  if (!termServer) return;

  const startedAt = Date.now();
  const result = await termServer.post(bulkLookupUrl, params);
  const duration = Date.now() - startedAt;
  log(`Done code lookup. Duration: ${duration} ms`);

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

export function buildMultipleFhirParametersFromCodings(
  codings: Coding[] | undefined
): Parameters[] | undefined {
  return codings?.flatMap(coding => buildFhirParametersFromCoding(coding) || []);
}

export function buildFhirParametersFromCoding(coding: Coding): Parameters | undefined {
  const code = coding.code?.trim();
  const system = coding.system?.trim();
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

export function buildFhirParametersForCrosswalkFromCoding(
  coding: Coding,
  targetSystem: string
): Parameters | undefined {
  const code = coding.code?.trim();
  const system = coding.system?.trim();
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
  ];

  return {
    resourceType: "Parameters",
    parameter,
    id: createUuidFromText(JSON.stringify(parameter)),
  };
}
