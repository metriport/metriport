import z from "zod";

export type AthenaJwtTokenData = {
  ah_practice: string;
  ah_department: string;
  source: "athenahealth";
};

export type AthenaClientJwtTokenData = {
  practiceId: string;
  cxId: string;
  source: "athenahealth-client";
};

export const athenaClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.string(),
});
