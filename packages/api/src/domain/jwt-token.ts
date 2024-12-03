import { BaseDomain } from "@metriport/core/domain/base-domain";
import { AthenaJwtTokenData } from "@metriport/shared/src/interface/external/athenahealth/jwt-token";
import { EhrSources } from "../external/ehr/shared";

export type JwtTokenSources = EhrSources.athena;
export function isJwtTokenSource(source: string): source is JwtTokenSources {
  return source === EhrSources.athena;
}
export type JwtTokenData = AthenaJwtTokenData;

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
  source: JwtTokenSources;
  data: JwtTokenData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
