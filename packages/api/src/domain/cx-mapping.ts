import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  AthenaSecondaryMappings,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/athenahealth/cx-mapping";
import { z } from "zod";
import { EhrSources } from "../external/ehr/shared";

export type CxMappingSource = EhrSources.athena | EhrSources.elation;
export function isCxMappingSource(source: string): source is CxMappingSource {
  return source === EhrSources.athena || source === EhrSources.elation;
}

export type CxSecondaryMappings = AthenaSecondaryMappings | null;
export const secondaryMappingsSchemaMap: { [key in CxMappingSource]: z.Schema | undefined } = {
  [EhrSources.athena]: athenaSecondaryMappingsSchema,
  [EhrSources.elation]: undefined,
};

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
  source: CxMappingSource;
  secondaryMappings: CxSecondaryMappings;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
