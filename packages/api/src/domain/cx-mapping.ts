import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type CxSources = EhrSources;

export interface CxMapping extends BaseDomain {
  externalId: string;
  cxId: string;
  source: CxSources;
}
