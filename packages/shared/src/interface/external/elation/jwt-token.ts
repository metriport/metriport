import z from "zod";
import { EhrSources, clientSourceSuffix, webhookSourceSuffix } from "../shared/ehr/source";

export const elationClientSource = `${EhrSources.elation}${clientSourceSuffix}` as const;
export const elationClientJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  cxId: z.string(),
  source: z.literal(`${elationClientSource}`),
});
export type ElationClientJwtTokenData = z.infer<typeof elationClientJwtTokenDataSchema>;

export const elationWebhookSource = `${EhrSources.elation}${webhookSourceSuffix}` as const;
export const elationWebhookJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  cxId: z.string(),
  source: z.literal(`${elationWebhookSource}`),
});
export type ElationWebhookJwtTokenData = z.infer<typeof elationWebhookJwtTokenDataSchema>;

export const elationClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
