import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  AthenaClientJwtTokenData,
  AthenaJwtTokenData,
} from "@metriport/shared/src/interface/external/athenahealth/jwt-token";
import { ElationClientJwtTokenData } from "@metriport/shared/src/interface/external/elation/jwt-token";
import { athenaClientJwtTokenSource } from "../external/ehr/athenahealth/shared";
import { elationClientJwtTokenSource } from "../external/ehr/elation/shared";
import { EhrSources } from "../external/ehr/shared";

export type JwtTokenSource =
  | EhrSources.athena
  | typeof athenaClientJwtTokenSource
  | typeof elationClientJwtTokenSource;

export function isJwtTokenSource(source: string): source is JwtTokenSource {
  return (
    source === EhrSources.athena ||
    source === athenaClientJwtTokenSource ||
    source === elationClientJwtTokenSource
  );
}

export type JwtTokenData =
  | AthenaJwtTokenData
  | AthenaClientJwtTokenData
  | ElationClientJwtTokenData;

export type JwtTokenPerSource = {
  token: string;
  exp: Date;
  source: JwtTokenSource;
  data: JwtTokenData;
};

export interface JwtToken extends BaseDomain, JwtTokenPerSource {}
