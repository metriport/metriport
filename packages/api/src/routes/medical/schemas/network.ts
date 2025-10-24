import { z } from "zod";

export const networkQuerySchema = z.object({
  sources: z.array(z.enum(["hie", "pharmacy", "laboratory"])),
  override: z.boolean().optional(),
  commonwell: z.boolean().optional(),
  carequality: z.boolean().optional(),
  metadata: z.record(z.string().min(1).max(40), z.string().max(500)).optional(),
});

export type NetworkQuery = z.infer<typeof networkQuerySchema>;
