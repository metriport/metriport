import { z } from "zod";

export const athenaSecondaryMappingsSchema = z.object({
  departmentIds: z.string().array(),
});
export type AthenaSecondaryMappings = z.infer<typeof athenaSecondaryMappingsSchema>;
