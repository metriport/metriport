import { z } from "zod";

export const clientKeyAndSecretMapsSecretSchema = z.record(
  z.string(),
  z.object({
    clientKey: z.string(),
    clientSecret: z.string(),
  })
);
