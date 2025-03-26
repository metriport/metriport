import { z } from "zod";

export const athenaSecondaryMappingsSchema = z.object({
  departmentIds: z.string().array(),
  webhookAppointmentDisabled: z.boolean().optional(),
  backgroundAppointmentsDisabled: z.boolean().optional(),
});
export type AthenaSecondaryMappings = z.infer<typeof athenaSecondaryMappingsSchema>;
