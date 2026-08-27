import { z } from "zod";

export const refreshTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string().optional(),
});

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;
