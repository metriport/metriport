import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  AthenaClientJwtTokenData,
  AthenaJwtTokenData,
} from "@metriport/shared/src/interface/external/athenahealth/jwt-token";
import { athenaClientJwtTokenSource } from "../external/ehr/athenahealth/shared";
import { EhrSources } from "../external/ehr/shared";

export type JwtTokenSource = EhrSources.athena | typeof athenaClientJwtTokenSource;
export function isJwtTokenSource(source: string): source is JwtTokenSource {
  return source === EhrSources.athena || source === athenaClientJwtTokenSource;
}

export type JwtTokenData = AthenaJwtTokenData | AthenaClientJwtTokenData;

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
  source: JwtTokenSource;
  data: JwtTokenData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
