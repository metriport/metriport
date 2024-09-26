import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type CxSources = EhrSources;

export type SecondaryMappings = { [k: string]: object } | null;

export interface CxMapping extends BaseDomain {
  externalId: string;
  secondaryMappings: SecondaryMappings;
  cxId: string;
  source: CxSources;
}
