import { BaseDomain } from "@metriport/core/domain/base-domain";

export interface JwtToken extends BaseDomain {
  token: string;
  exp: Date;
  source: string;
  data: object;
}
