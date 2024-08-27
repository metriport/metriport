export interface JwtToken {
  token: string;
  exp: Date;
  source: string;
  data: object;
}
