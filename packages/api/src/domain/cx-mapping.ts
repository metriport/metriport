import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  EhrCxMappingSecondaryMappings,
  ehrCxMappingSecondaryMappingsSchemaMap,
} from "@metriport/core/external/ehr/mappings";
import { ehrSources } from "@metriport/shared/interface/external/ehr/source";
import { z } from "zod";

const cxMappingSource = [...ehrSources] as const;
export type CxMappingSource = (typeof cxMappingSource)[number];
export function isCxMappingSource(source: string): source is CxMappingSource {
  return cxMappingSource.includes(source as CxMappingSource);
}

export type CxMappingSecondaryMappings = EhrCxMappingSecondaryMappings | null;
export const secondaryMappingsSchemaMap: { [key in CxMappingSource]: z.Schema | undefined } = {
  ...ehrCxMappingSecondaryMappingsSchemaMap,
};

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
  source: CxMappingSource;
  secondaryMappings: CxMappingSecondaryMappings;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
