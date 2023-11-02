import { z } from "zod";

export const cxRequestMetadataScheme = z.object({
  meta: z.record(z.string().min(1).max(40), z.string().max(40).optional()),
});
