import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  AthenaClientJwtTokenData,
  AthenaJwtTokenData,
} from "@metriport/shared/src/interface/external/athenahealth/jwt-token";
import {
  CanvasClientJwtTokenData,
  CanvasJwtTokenData,
} from "@metriport/shared/src/interface/external/canvas/jwt-token";
import {
  ElationJwtTokenData,
  ElationClientJwtTokenData,
} from "@metriport/shared/src/interface/external/elation/jwt-token";
import { athenaClientJwtTokenSource } from "../external/ehr/athenahealth/shared";
import { elationClientJwtTokenSource } from "../external/ehr/elation/shared";
import { canvasClientJwtTokenSource } from "../external/ehr/canvas/shared";
import { EhrSources } from "../external/ehr/shared";

const jwtTokenSource = [
  EhrSources.athena,
  athenaClientJwtTokenSource,
  EhrSources.elation,
  elationClientJwtTokenSource,
  EhrSources.canvas,
  canvasClientJwtTokenSource,
] as const;

export type JwtTokenSource = (typeof jwtTokenSource)[number];
export function isJwtTokenSource(source: string): source is JwtTokenSource {
  return jwtTokenSource.includes(source as JwtTokenSource);
}

export type JwtTokenData =
  | AthenaJwtTokenData
  | AthenaClientJwtTokenData
  | ElationJwtTokenData
  | ElationClientJwtTokenData
  | CanvasJwtTokenData
  | CanvasClientJwtTokenData;

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
  source: JwtTokenSource;
  data: JwtTokenData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
