import { BaseDomain } from "@metriport/core/domain/base-domain";

export type FacilityMappingSource = FacilityMappingParams["source"];
export const facilityMappingSourceList: FacilityMappingSource[] = [];

export interface FacilityMappingParams {
  externalId: string;
  cxId: string;
  facilityId: string;
  source: string;
}

export interface FacilityMapping extends BaseDomain, FacilityMappingParams {}
