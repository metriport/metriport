import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  AthenaClientJwtTokenData,
  AthenaJwtTokenData,
} from "@metriport/shared/src/interface/external/athenahealth/jwt-token";
import { athenaClientJwtTokenSource } from "../external/ehr/athenahealth/shared";
import { EhrSources } from "../external/ehr/shared";

const jwtTokenSources = [EhrSources.athena, athenaClientJwtTokenSource] as const;
export type JwtTokenSource = (typeof jwtTokenSources)[number];
export function isJwtTokenSource(source: string): source is JwtTokenSource {
  return jwtTokenSources.includes(source as JwtTokenSource);
}

export type JwtTokenData = AthenaJwtTokenData | AthenaClientJwtTokenData;

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
  source: JwtTokenSource;
  data: JwtTokenData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
