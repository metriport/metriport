import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

const facilityMappingSources = [EhrSources.athena, EhrSources.elation] as const;
export type FacilityMappingSource = (typeof facilityMappingSources)[number];
export function isFacilityMappingSource(source: string): source is FacilityMappingSource {
  return facilityMappingSources.includes(source as FacilityMappingSource);
}

export type FacilityMappingPerSource = {
  externalId: string;
  cxId: string;
  facilityId: string;
  source: FacilityMappingSource;
};

export interface FacilityMapping extends BaseDomain, FacilityMappingPerSource {}
