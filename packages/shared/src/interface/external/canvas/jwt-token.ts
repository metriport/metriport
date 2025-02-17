import z from "zod";

export const canvasJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  source: z.literal("canvas"),
});

export type CanvasJwtTokenData = z.infer<typeof canvasJwtTokenDataSchema>;

export type CanvasClientJwtTokenData = {
  practiceId: string;
  cxId: string;
  source: "canvas-client";
};

export const canvasClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.coerce.string(),
});
