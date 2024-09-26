import { BaseDomain } from "@metriport/core/domain/base-domain";

export type JwtTokenSource = JwtTokenParams["source"];
export type JwtTokenData = JwtTokenParams["data"];

export type JwtTokenParams = {
  token: string;
  exp: Date;
  source: string;
  data: unknown | null;
};

export interface JwtToken extends BaseDomain, JwtTokenParams {}
