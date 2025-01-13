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
  RXNORM_URL,
  SNOMED_URL,
} from "../../util/constants";
import { EventMessageV1 } from "../analytics/posthog";

export type CodeSystemLookupOutput = {
  name: string;
  id: string;
  display: string;
  code: string;
  property?: { code: string; description: string; value: TypedValue }[];
};

export const termServerUrl = Config.getTermServerUrl();
const bulkLookupUrl = "terminology/code-system/lookup/bulk";

export const supportedSystems = [ICD_10_URL, SNOMED_URL, LOINC_URL, RXNORM_URL, CPT_URL, CVX_URL];

export function isSystemValid(system: string) {
  const trimmedSystem = system.trim();
  if (supportedSystems.includes(trimmedSystem)) return true;
  return false;
}

export function buildTermServerApi(): AxiosInstance | undefined {
  if (!termServerUrl) return undefined;

  return axios.create({
    baseURL: termServerUrl,
    timeout: 30_000,
    transitional: {
      clarifyTimeoutError: true,
    },
  });
}

export async function lookupMultipleCodes(
  params: Parameters[],
  metrics: EventMessageV1
): Promise<CodeSystemLookupOutput[] | undefined> {
  const termServer = buildTermServerApi();
  if (!termServer) return;

  const startedAt = Date.now();
  const result = await termServer.post(bulkLookupUrl, params);
  const duration = Date.now() - startedAt;
  console.log(`Done code lookup. Duration: ${duration} ms`);

  const data = result.data.filter(
    (d: { resourceType: string }) => d.resourceType !== "OperationOutcome"
  ) as CodeSystemLookupOutput[];

  if (metrics.properties) {
    metrics.properties.numParams = params.length;
    metrics.properties.numFound = data.length;
    metrics.properties.lookupDuration = duration;
  }

  return data;
}

export function buildTermServerParametersFromCodings(
  codings: Coding[] | undefined
): Parameters[] | undefined {
  const params = codings?.flatMap(coding => {
    const code = coding.code?.trim();
    const system = coding.system?.trim();
    if (!code || !system) return [];
    const param = buildTermServerParameter({ system, code });
    return param ?? [];
  });

  return params;
}

export function buildTermServerParameter({
  system,
  code,
}: {
  system: string;
  code: string;
}): Parameters | undefined {
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
