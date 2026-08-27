import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  EhrCxMappingSecondaryMappings,
  EmbedCxMappingSecondaryMappings,
  ehrCxMappingSecondaryMappingsSchemaMapGeneral,
  embedCxMappingSecondaryMappingsSchemaMap,
} from "@metriport/core/external/ehr/mappings";
import { embedDashSource } from "@metriport/shared/interface/external/ehr/embed/jwt-token";
import { ehrSources } from "@metriport/shared/interface/external/ehr/source";
import { z } from "zod";

const cxMappingSource = [...ehrSources, embedDashSource] as const;
export type CxMappingSource = (typeof cxMappingSource)[number];
export function isCxMappingSource(source: string): source is CxMappingSource {
  return cxMappingSource.includes(source as CxMappingSource);
}
export type CxMappingSecondaryMappings =
  | EhrCxMappingSecondaryMappings
  | EmbedCxMappingSecondaryMappings
  | null;
export const secondaryMappingsSchemaMap: { [key in CxMappingSource]: z.Schema | undefined } = {
  ...ehrCxMappingSecondaryMappingsSchemaMapGeneral,
  ...embedCxMappingSecondaryMappingsSchemaMap,
};

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
  source: CxMappingSource;
  secondaryMappings: CxMappingSecondaryMappings;
  defaultCohortId?: string | null;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
