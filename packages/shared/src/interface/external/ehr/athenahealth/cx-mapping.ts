import { z } from "zod";
import { writeBackFiltersSchema } from "../shared";

export const athenaSecondaryMappingsSchema = z
  .object({
    departmentIds: z.string().array(),
    webhookAppointmentDisabled: z.boolean().optional(),
    backgroundAppointmentsDisabled: z.boolean().optional(),
    appointmentTypesFilter: z.string().array().optional(),
  })
  .merge(writeBackFiltersSchema);
export type AthenaSecondaryMappings = z.infer<typeof athenaSecondaryMappingsSchema>;
