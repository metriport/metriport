import { BaseDomain } from "@metriport/core/domain/base-domain";

export interface CxMapping extends BaseDomain {
  externalId: string;
  cxId: string;
  source: string;
}
