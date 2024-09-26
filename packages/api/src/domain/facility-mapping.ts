import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type FacilitySources = FacilityMappingPerSource["source"];

export const facilitysMappingsSourceList: string[] = [EhrSources.ATHENA];

export type FacilityMappingPerSource = {
  externalId: string;
  cxId: string;
  facilityId: string;
} & {
  source: EhrSources.ATHENA;
};

export interface FacilityMapping extends BaseDomain, FacilityMappingPerSource {}
