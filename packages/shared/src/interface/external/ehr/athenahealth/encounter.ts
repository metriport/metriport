import { z } from "zod";

const encounterSchema = z.object({
  appointmentid: z.coerce.string(),
  status: z.string(),
});
export type Encounter = z.infer<typeof encounterSchema>;

export const encountersSchema = encounterSchema.array();
export type Encounters = z.infer<typeof encountersSchema>;

export const encounterSummarySchema = z.object({
  summaryhtml: z.string(),
});
export type EncounterSummary = z.infer<typeof encounterSummarySchema>;
