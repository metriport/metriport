import { APIMode } from "../carequality";

export type CQOrgUrls = {
  urlXCPD?: string | undefined;
  urlDQ?: string | undefined;
  urlDR?: string | undefined;
};

export type CqOrgType = "Connection" | "Implementer";

export type CQOrgDetails = {
  name: string;
  oid: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  lat: string;
  lon: string;
  contactName: string;
  phone: string;
  email: string;
  /** Implementer is Metriport, all other Orgs/Facilities we manage are Connection */
  role: CqOrgType;
  active: boolean;
  /** Translates into the `partOf` field in Carequality. Usually either `metriportOid` or `metriportIntermediaryOid` */
  parentOrgOid: string;
  /** Gets translated into the DOA extension in Carequality. Only used for OBO facilities. @see https://sequoiaproject.org/SequoiaProjectHealthcareDirectoryImplementationGuide/output/StructureDefinition-DOA.html */
  oboOid?: string | undefined;
  /** Gets translated into the generated text extension in Carequality. Only used for OBO facilities. */
  oboName?: string | undefined;
};

export type CQOrgDetailsWithUrls = CQOrgDetails & CQOrgUrls;

export function getApiMode(): APIMode {
  const apiModeVarName = "CQ_API_MODE";
  const apiMode = getEnvVar(apiModeVarName);
  if (apiMode === "stage") return APIMode.staging;
  if (apiMode === "dev") return APIMode.dev;
  if (apiMode === "production") return APIMode.production;
  throw new Error(`Invalid ${apiModeVarName}: ${apiMode}`);
}

export function getEnvVar(varName: string): string | undefined {
  return process.env[varName];
}

export function getEnvVarOrFail(varName: string): string {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
}
