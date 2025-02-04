import z from "zod";

export type CanvasJwtTokenData = {
  practiceId: string;
  source: "canvas";
};

export type CanvasClientJwtTokenData = {
  practiceId: string;
  cxId: string;
  source: "canvas-client";
};

export const canvasClientJwtTokenResponseSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  expires_in: z.number(),
});
