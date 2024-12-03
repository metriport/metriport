import { BaseDomain } from "@metriport/core/domain/base-domain";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "../external/ehr/shared";

export type FacilityMappingSource = EhrSources.athena | EhrSources.elation;
export function isFacilityMappingSource(source: string): source is FacilityMappingSource {
  return source === EhrSources.athena || source === EhrSources.elation;
}
export function getFacilityMappingSource(source: string): FacilityMappingSource {
  if (isFacilityMappingSource(source)) return source;
  throw new BadRequestError(`Source ${source} is not valid facility mapping source.`);
}

export type FacilityMappingPerSource = {
  externalId: string;
  cxId: string;
  facilityId: string;
  source: FacilityMappingSource;
};

export interface FacilityMapping extends BaseDomain, FacilityMappingPerSource {}
