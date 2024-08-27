export interface JwtToken {
  token: string;
  exp: number;
  source: string;
  data: object;
}
