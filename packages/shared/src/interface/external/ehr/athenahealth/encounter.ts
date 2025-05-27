import { z } from "zod";

export const createdEncounterSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  encounterdocumentid: z.coerce.string().optional(),
});
export type CreatedEncounter = z.infer<typeof createdEncounterSchema>;
export const createdEncounterSuccessSchema = z.object({
  success: z.literal(true),
  encounterdocumentid: z.coerce.string(),
});
export type CreatedEncounterSuccess = z.infer<typeof createdEncounterSuccessSchema>;
