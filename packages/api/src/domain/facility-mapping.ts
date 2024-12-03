import { BaseDomain } from "@metriport/core/domain/base-domain";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "../external/ehr/shared";

export type FacilitySources = EhrSources.athena | EhrSources.elation;
export function isFacilityMappingSource(source: string): source is FacilitySources {
  return source === EhrSources.athena || source === EhrSources.elation;
}
export function getFacilityMappingSource(source: string): FacilitySources {
  if (!isFacilityMappingSource(source))
    throw new BadRequestError(`Source ${source} is not mapped.`);
  return source;
}

export type FacilityMappingPerSource = {
  externalId: string;
  cxId: string;
  facilityId: string;
  source: FacilitySources;
};

export interface FacilityMapping extends BaseDomain, FacilityMappingPerSource {}
