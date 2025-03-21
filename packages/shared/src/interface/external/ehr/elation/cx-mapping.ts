import { z } from "zod";
import { subscriptionResources } from "./subscription";

const webhookSchema = z.object({
  url: z.string(),
  signingKey: z.string(),
});

export const elationSecondaryMappingsSchema = z.object({
  webhooks: z.record(z.enum(subscriptionResources), webhookSchema).optional(),
  webhookAppointmentPatientProcessingDisabled: z.boolean().optional(),
  backgroundAppointmentPatientProcessingDisabled: z.boolean().optional(),
});
export type ElationSecondaryMappings = z.infer<typeof elationSecondaryMappingsSchema>;
