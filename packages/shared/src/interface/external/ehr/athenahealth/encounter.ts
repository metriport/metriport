import { z } from "zod";

export const encounterSchema = z.object({
  encounterid: z.string(),
  appointmentid: z.string(),
  patientid: z.string(),
  departmentid: z.string(),
});
export type Encounter = z.infer<typeof encounterSchema>;

export const encounterSummarySchema = z.object({
  summaryhtml: z.string(),
});
export type EncounterSummary = z.infer<typeof encounterSummarySchema>;
