import z from "zod";
import { EhrSources } from "../source";

export const touchworksDashSource = EhrSources.touchworks as const;
export const touchworksDashJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  patientId: z.string(),
  source: z.literal(`${touchworksDashSource}`),
});
export type TouchworksDashJwtTokenData = z.infer<typeof touchworksDashJwtTokenDataSchema>;
