import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  EhrClientJwtTokenData,
  ehrClientJwtTokenSource,
  EhrDashJwtTokenData,
  ehrDashJwtTokenSource,
  EhrWebhookJwtTokenData,
  ehrWebhookJwtTokenSource,
} from "../external/ehr/shared";

const jwtTokenSource = [
  ...ehrDashJwtTokenSource,
  ...ehrClientJwtTokenSource,
  ...ehrWebhookJwtTokenSource,
] as const;

export type JwtTokenSource = (typeof jwtTokenSource)[number];
export function isJwtTokenSource(source: string): source is JwtTokenSource {
  return jwtTokenSource.includes(source as JwtTokenSource);
}

export type JwtTokenData = EhrDashJwtTokenData | EhrClientJwtTokenData | EhrWebhookJwtTokenData;

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
  source: JwtTokenSource;
  data: JwtTokenData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
