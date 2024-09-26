import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type CxSources = CxMappingPerSource["source"];
export type CxSecondaryMappings = CxMappingPerSource["secondaryMappings"];

export type AthenaSecondaryMappings = { departmentIds: string[] } | null;

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
} & {
  source: EhrSources.ATHENA;
  secondaryMappings: AthenaSecondaryMappings;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
