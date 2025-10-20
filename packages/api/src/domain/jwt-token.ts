import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  EhrClientJwtTokenData,
  ehrClientJwtTokenSources,
  EhrDashJwtTokenData,
  ehrDashJwtTokenSources,
  EhrWebhookJwtTokenData,
  ehrWebhookJwtTokenSources,
} from "../external/ehr/shared/utils/jwt-token";

const jwtTokenSource = [
  ...ehrClientJwtTokenSources,
  ...ehrDashJwtTokenSources,
  ...ehrWebhookJwtTokenSources,
] as const;
export type JwtTokenSource = (typeof jwtTokenSource)[number];
export function isJwtTokenSource(source: string): source is JwtTokenSource {
  return jwtTokenSource.includes(source as JwtTokenSource);
}

export type JwtTokenData = EhrClientJwtTokenData | EhrDashJwtTokenData | EhrWebhookJwtTokenData;

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
  source: JwtTokenSource;
  data: JwtTokenData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
