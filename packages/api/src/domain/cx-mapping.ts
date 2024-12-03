import { BadRequestError } from "@metriport/shared";
import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  AthenaSecondaryMappings,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/athenahealth/cx-mapping";
import { z } from "zod";
import { EhrSources } from "../external/ehr/shared";

export type CxSources = EhrSources.athena | EhrSources.elation;
export function isCxMappingSource(source: string): source is CxSources {
  return source === EhrSources.athena || source === EhrSources.elation;
}
export function getCxMappingSource(source: string): CxSources {
  if (!isCxMappingSource(source)) throw new BadRequestError(`Source ${source} is not mapped.`);
  return source;
}

export type CxSecondaryMappings = AthenaSecondaryMappings | null;
export const secondaryMappingsParserMap: { [key in CxSources]: z.Schema | undefined } = {
  [EhrSources.athena]: athenaSecondaryMappingsSchema,
  [EhrSources.elation]: undefined,
};

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
  source: CxSources;
  secondaryMappings: CxSecondaryMappings;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
