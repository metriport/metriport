import { z } from "zod";

export const introspectResponseSchema = z.object({
  active: z.boolean(),
  ah_practice: z.string(),
});

export type IntrospectResponse = z.infer<typeof introspectResponseSchema>;
