import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type FacilityMappingSource = EhrSources.athena | EhrSources.elation;
export function isFacilityMappingSource(source: string): source is FacilityMappingSource {
  return source === EhrSources.athena || source === EhrSources.elation;
}

export type FacilityMappingPerSource = {
  externalId: string;
  cxId: string;
  facilityId: string;
  source: FacilityMappingSource;
};

export interface FacilityMapping extends BaseDomain, FacilityMappingPerSource {}
