import z from "zod";

export const athenaJwtTokenDataSchema = z.object({
  ah_practice: z.string(),
  ah_department: z.string(),
  source: z.literal("athenahealth"),
});

export type AthenaJwtTokenData = z.infer<typeof athenaJwtTokenDataSchema>;

export type AthenaClientJwtTokenData = {
  practiceId: string;
  cxId: string;
  source: "athenahealth-client";
};

export const athenaClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
