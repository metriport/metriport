import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type JwtTokenSources = JwtTokenPerSource["source"];
export type JwtTokenData = JwtTokenPerSource["data"];

export type AthenaData = {
  ah_practice: string;
  ah_department: string;
};

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
} & {
  source: EhrSources.ATHENA;
  data: AthenaData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
