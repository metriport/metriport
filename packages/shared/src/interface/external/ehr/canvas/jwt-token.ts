import z from "zod";
import { EhrSources, clientSourceSuffix, webhookSourceSuffix } from "../source";

export const canvasDashSource = EhrSources.canvas as const;
export const canvasDashJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  source: z.literal(`${canvasDashSource}`),
});
export type CanvasDashJwtTokenData = z.infer<typeof canvasDashJwtTokenDataSchema>;

export const canvasClientSource = `${EhrSources.canvas}${clientSourceSuffix}` as const;
export const canvasClientJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  cxId: z.string(),
  source: z.literal(`${canvasClientSource}`),
});
export type CanvasClientJwtTokenData = z.infer<typeof canvasClientJwtTokenDataSchema>;

export const canvasWebhookSource = `${EhrSources.canvas}${webhookSourceSuffix}` as const;
export const canvasWebhookJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  cxId: z.string(),
  source: z.literal(`${canvasWebhookSource}`),
});
export type CanvasWebhookJwtTokenData = z.infer<typeof canvasWebhookJwtTokenDataSchema>;

export const canvasClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
