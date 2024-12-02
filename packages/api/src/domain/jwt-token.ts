import { BaseDomain } from "@metriport/core/domain/base-domain";
import { AthenaJwtTokenData } from "@metriport/shared/src/interface/external/athenahealth/jwt-token";
import { EhrSources } from "../external/ehr/shared";

export type JwtTokenSources = JwtTokenPerSource["source"];
export type JwtTokenData = JwtTokenPerSource["data"];

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
  source: EhrSources.athena;
  data: AthenaJwtTokenData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
