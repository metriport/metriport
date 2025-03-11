import { BaseDomain } from "@metriport/core/domain/base-domain";
import { ehrSources } from "@metriport/shared/src/interface/external/shared/ehr/source";
import { z } from "zod";
import { ehrCxMappingSecondaryMappingsSchemaMap } from "../external/ehr/shared";

const cxMappingSource = [...ehrSources] as const;
export type CxMappingSource = (typeof cxMappingSource)[number];
export function isCxMappingSource(source: string): source is CxMappingSource {
  return cxMappingSource.includes(source as CxMappingSource);
}

export type CxMappingSecondaryMappings = {
  [key in CxMappingSource]: z.Schema | undefined;
};
export const secondaryMappingsSchemaMap: CxMappingSecondaryMappings = {
  ...ehrCxMappingSecondaryMappingsSchemaMap,
};

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
  source: CxMappingSource;
  secondaryMappings: CxMappingSecondaryMappings;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
