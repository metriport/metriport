import { z } from "zod";

export const cxRequestMetadataSchema = z.object({
  metadata: z
    .record(z.string().min(1).max(40), z.string().max(500))
    .optional()
    .refine(record => (record ? Object.keys(record).length <= 50 : true), {
      message: "Record has too many properties",
      path: ["meta"],
    }),
});
