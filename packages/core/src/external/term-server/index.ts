import { TypedValue } from "@medplum/core";
import { Coding, Parameters, ParametersParameter } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import axios, { AxiosInstance } from "axios";
// import { Config } from "../../util/config";
// import fs from "fs";
import { Config } from "../../util/config";
import {
  CPT_URL,
  CVX_URL,
  ICD_10_URL,
  LOINC_URL,
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
const bulkLookupUrl = "terminology/code-system/lookup/bulk";

export const supportedSystems = [ICD_10_URL, SNOMED_URL, LOINC_URL, RXNORM_URL, CPT_URL, CVX_URL];

// http://hl7.org/fhir/sid/ndc - unsupported
// http://terminology.hl7.org/ValueSet/v3-Unknown - nope
// http://terminology.hl7.org/CodeSystem/ICD-9CM-diagnosiscodes - unsupported
// http://terminology.hl7.org/CodeSystem-IMO.html - unsupported
// http://nucc.org/provider-taxonomy - unsupported

export function isSystemValid(system: string) {
  const trimmedSystem = system.trim();
  if (supportedSystems.includes(trimmedSystem)) return true;
  return false;
}

export function buildTermServerApi(url?: string): AxiosInstance | undefined {
  console.log("TRYNNA GET URL", termServerUrl, "vs", url);

  const apiUrl = termServerUrl ?? url ?? undefined;
  if (!apiUrl) return undefined;

  console.log("Defaulting to", apiUrl);
  return axios.create({
    baseURL: apiUrl,
    timeout: 30_000,
    transitional: {
      clarifyTimeoutError: true,
    },
  });
}

export async function lookupMultipleCodes(
  params: Parameters[],
  termServerUrl?: string
): Promise<CodeSystemLookupOutput[] | undefined> {
  const termServer = buildTermServerApi(termServerUrl);
  if (!termServer) return;

  const startedAt = Date.now();

  const result = await termServer.post(bulkLookupUrl, params);
  const data = result.data.filter(
    (d: { resourceType: string }) => d.resourceType !== "OperationOutcome"
  ) as CodeSystemLookupOutput[];

  console.log("params.length", params.length);
  console.log("data.length", data.length);

  const duration = Date.now() - startedAt;
  console.log(`Done code lookup. Duration: ${duration} ms`);

  return data;
}

export function buildTermServerParametersFromCodings(
  codings: Coding[] | undefined
): Parameters[] | undefined {
  // TODO: Remove when done testing
  // const filePath = "codesystems.json";
  // let existingSystems = new Set<string>();
  // if (fs.existsSync(filePath)) {
  //   try {
  //     const data = fs.readFileSync(filePath, "utf-8");
  //     existingSystems = new Set(JSON.parse(data));
  //   } catch (error) {
  //     console.error("Failed to read or parse the file:", error);
  //   }
  // }

  // const newSystems = new Set<string>(); // TODO: Remove when done testing

  const params = codings?.flatMap(coding => {
    const code = coding.code?.trim();
    const system = coding.system?.trim();
    if (!code || !system) return [];

    // if (!system.includes("114350") && !system.includes("113883")) newSystems.add(system.trim()); // TODO: Remove when done testing
    const param = buildTermServerParameter({ system, code });
    return param ?? [];
  });

  // TODO: Remove when done testing
  // if (newSystems.size > 0) {
  //   const updatedSystems = new Set([...existingSystems, ...newSystems]);
  //   try {
  //     fs.writeFileSync(filePath, JSON.stringify([...updatedSystems], null, 2));
  //   } catch (error) {
  //     console.error("Failed to write to the file:", error);
  //   }
  // }
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
