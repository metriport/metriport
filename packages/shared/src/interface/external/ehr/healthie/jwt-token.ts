import z from "zod";
import { EhrSources } from "../source";

export const healthieDashSource = EhrSources.healthie as const;
export const healthieDashJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  patientId: z.string(),
  source: z.literal(`${healthieDashSource}`),
});
export type HealthieDashJwtTokenData = z.infer<typeof healthieDashJwtTokenDataSchema>;
