import { BaseDomain } from "@metriport/core/domain/base-domain";
import { ehrSources } from "../external/ehr/shared";

const facilityMappingSource = [...ehrSources] as const;
export type FacilityMappingSource = (typeof facilityMappingSource)[number];
export function isFacilityMappingSource(source: string): source is FacilityMappingSource {
  return facilityMappingSource.includes(source as FacilityMappingSource);
}

export type FacilityMappingPerSource = {
  externalId: string;
  cxId: string;
  facilityId: string;
  source: FacilityMappingSource;
};

export interface FacilityMapping extends BaseDomain, FacilityMappingPerSource {}
