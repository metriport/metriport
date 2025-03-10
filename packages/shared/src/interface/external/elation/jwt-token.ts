import z from "zod";

export type ElationClientJwtTokenData = {
  practiceId: string;
  cxId: string;
  source: "elation-client";
};

export const elationWebhookJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  cxId: z.string(),
  source: z.literal("elation-webhook"),
});

export type ElationWebhookJwtTokenData = z.infer<typeof elationWebhookJwtTokenDataSchema>;

export const elationClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
