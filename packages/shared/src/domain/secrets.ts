import { z } from "zod";

export const cxClientKeyAndSecretMapSecretSchema = z.record(
  z.string(),
  z.object({
    clientKey: z.string(),
    clientSecret: z.string(),
  })
);
