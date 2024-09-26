import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type FacilitySources = FacilityMappingPerSource["source"];

export const facilitysMappingsSourceList: string[] = [EhrSources.athena];

export type FacilityMappingPerSource = {
  externalId: string;
  cxId: string;
  facilityId: string;
} & {
  source: EhrSources.athena;
};

export interface FacilityMapping extends BaseDomain, FacilityMappingPerSource {}
