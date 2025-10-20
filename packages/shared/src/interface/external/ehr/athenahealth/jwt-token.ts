import z from "zod";
import { EhrSources, clientSourceSuffix } from "../source";

export const athenaDashSource = EhrSources.athena as const;
export const athenaDashJwtTokenDataSchema = z.object({
  ah_practice: z.string(),
  ah_department: z.string(),
  source: z.literal(`${athenaDashSource}`),
});
export type AthenaDashJwtTokenData = z.infer<typeof athenaDashJwtTokenDataSchema>;

export const athenaClientSource = `${EhrSources.athena}${clientSourceSuffix}` as const;
export const athenaClientJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  cxId: z.string(),
  source: z.literal(`${athenaClientSource}`),
});
export type AthenaClientJwtTokenData = z.infer<typeof athenaClientJwtTokenDataSchema>;

export const athenaClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
