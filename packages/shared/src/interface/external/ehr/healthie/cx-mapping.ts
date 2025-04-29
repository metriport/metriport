import { z } from "zod";
import { subscriptionResources } from "./subscription";

const webhookSchema = z.object({
  url: z.string(),
  secretKey: z.string(),
});

export const healthieSecondaryMappingsSchema = z.object({
  webhooks: z.record(z.enum(subscriptionResources), webhookSchema).optional(),
  webhookPatientPatientLinkingDisabled: z.boolean().optional(),
  webhookPatientPatientProcessingEnabled: z.boolean().optional(),
  webhookAppointmentPatientLinkingDisabled: z.boolean().optional(),
  webhookAppointmentPatientProcessingDisabled: z.boolean().optional(),
  backgroundAppointments48hrDisabled: z.boolean().optional(),
  backgroundAppointment48hrPatientProcessingDisabled: z.boolean().optional(),
});
export type HealthieSecondaryMappings = z.infer<typeof healthieSecondaryMappingsSchema>;
