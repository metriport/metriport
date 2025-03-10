import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources, ehrSources } from "@metriport/core/external/shared/ehr";
import {
  AthenaSecondaryMappings,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/athenahealth/cx-mapping";
import { z } from "zod";

const cxMappingSource = [...ehrSources] as const;
export type CxMappingSource = (typeof cxMappingSource)[number];
export function isCxMappingSource(source: string): source is CxMappingSource {
  return cxMappingSource.includes(source as CxMappingSource);
}

export type CxMappingSecondaryMappings = AthenaSecondaryMappings | null;
export const secondaryMappingsSchemaMap: { [key in CxMappingSource]: z.Schema | undefined } = {
  [EhrSources.athena]: athenaSecondaryMappingsSchema,
  [EhrSources.elation]: undefined,
  [EhrSources.canvas]: undefined,
};

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
  source: CxMappingSource;
  secondaryMappings: CxMappingSecondaryMappings;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
