import { z } from "zod";
import { documentQueryWebhookFiltersSchema, writeBackFiltersSchema } from "../shared";

export const canvasSecondaryMappingsSchema = z
  .object({
    webhookPatientPatientProcessingEnabled: z.boolean().optional(),
    adtProcessingEnabled: z.boolean().optional(),
  })
  .merge(writeBackFiltersSchema)
  .merge(documentQueryWebhookFiltersSchema);
export type CanvasSecondaryMappings = z.infer<typeof canvasSecondaryMappingsSchema>;
