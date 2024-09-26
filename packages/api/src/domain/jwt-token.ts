import { BaseDomain } from "@metriport/core/domain/base-domain";

export type JwtTokenData = {
  token: string;
  exp: Date;
  source: string;
  data: object;
};

export interface JwtToken extends BaseDomain, JwtTokenData {}
