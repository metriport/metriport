import { z } from "zod";

export const athenaSecondaryMappingsSchema = z.object({
  departmentIds: z.string().array(),
  webhookAppointmentDisabled: z.boolean().optional(),
  backgroundAppointmentsDisabled: z.boolean().optional(),
  appointmentTypesFilter: z.string().array().optional(),
});
export type AthenaSecondaryMappings = z.infer<typeof athenaSecondaryMappingsSchema>;
