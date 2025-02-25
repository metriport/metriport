import z from "zod";

export type ElationClientJwtTokenData = {
  practiceId: string;
  cxId: string;
  source: "elation-client";
};

export type ElationWebhookJwtTokenData = {
  practiceId: string;
  cxId: string;
  source: "elation-webhook";
};

export const elationClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
