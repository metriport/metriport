import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type FacilitySources = EhrSources;

export interface FacilityMapping extends BaseDomain {
  externalId: string;
  cxId: string;
  facilityId: string;
  source: FacilitySources;
}
