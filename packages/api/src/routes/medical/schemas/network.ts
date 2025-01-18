import { z } from "zod";

export const networkGetSchema = z.object({
  filter: z.string().optional(),
  fromItem: z.string().optional(),
  toItem: z.string().optional(),
  count: z.coerce.number().int().optional(),
});

export type NetworkGetParams = z.infer<typeof networkGetSchema>;
