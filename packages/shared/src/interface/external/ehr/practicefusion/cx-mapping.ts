import { z } from "zod";
import { documentQueryWebhookFiltersSchema, writeBackFiltersSchema } from "../shared";

export const practicefusionSecondaryMappingsSchema = z
  .object({
    acceptedTermsOfServiceTimestamp: z.string().datetime().optional(),
    backgroundAppointmentsDisabled: z.boolean().optional(),
  })
  .merge(writeBackFiltersSchema)
  .merge(documentQueryWebhookFiltersSchema);
export type PracticeFusionSecondaryMappings = z.infer<typeof practicefusionSecondaryMappingsSchema>;
