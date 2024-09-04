import { BaseDomain } from "@metriport/core/domain/base-domain";

export interface FacilityMapping extends BaseDomain {
  externalId: string;
  cxId: string;
  facilityId: string;
  source: string;
}
