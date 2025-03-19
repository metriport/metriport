import z from "zod";
import { EhrSources, clientSourceSuffix } from "../source";

export const elationDashSource = EhrSources.elation as const;
export const elationDashJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  patientId: z.string(),
  source: z.literal(`${elationDashSource}`),
});
export type ElationDashJwtTokenData = z.infer<typeof elationDashJwtTokenDataSchema>;

export const elationClientSource = `${EhrSources.elation}${clientSourceSuffix}` as const;
export const elationClientJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  cxId: z.string(),
  source: z.literal(`${elationClientSource}`),
});
export type ElationClientJwtTokenData = z.infer<typeof elationClientJwtTokenDataSchema>;

export const elationClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
