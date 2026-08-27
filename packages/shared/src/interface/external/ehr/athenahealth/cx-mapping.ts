import { z } from "zod";
import { documentQueryWebhookFiltersSchema, writeBackFiltersSchema } from "../shared";

export const athenaSecondaryMappingsSchema = z
  .object({
    departmentIds: z.string().array(),
    webhookAppointmentDisabled: z.boolean().optional(),
    backgroundAppointmentsDisabled: z.boolean().optional(),
    appointmentTypesFilter: z.string().array().optional(),
    contributionEncounterAppointmentTypesBlacklist: z.string().array().optional(),
    contributionEncounterSummariesEnabled: z.boolean().optional(),
  })
  .merge(writeBackFiltersSchema)
  .merge(documentQueryWebhookFiltersSchema);
export type AthenaSecondaryMappings = z.infer<typeof athenaSecondaryMappingsSchema>;
