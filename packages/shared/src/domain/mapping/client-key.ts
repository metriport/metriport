import { z } from "zod";

export const clientKeyAndSecretSchema = z.record(
  z.string(),
  z.object({
    clientKey: z.string(),
    clientSecret: z.string(),
  })
);
