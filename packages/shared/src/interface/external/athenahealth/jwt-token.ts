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

export const tokenResponseSchema = z.object({
  patient: z.string(),
  ah_practice: z.string(),
  ah_department: z.string(),
  access_token: z.string(),
  id_token: z.string(),
});
