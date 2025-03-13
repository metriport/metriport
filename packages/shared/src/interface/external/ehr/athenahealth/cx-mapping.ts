import { z } from "zod";

export const athenaSecondaryMappingsSchema = z.object({
  departmentIds: z.string().array(),
  backgroundAppointmentsDisabled: z.boolean().optional(),
});
export type AthenaSecondaryMappings = z.infer<typeof athenaSecondaryMappingsSchema>;
