import z from "zod";

export const elationJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  source: z.literal("elation"),
});

export type ElationJwtTokenData = z.infer<typeof elationJwtTokenDataSchema>;

export type ElationClientJwtTokenData = {
  practiceId: string;
  cxId: string;
  source: "elation-client";
};

export const elationClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
