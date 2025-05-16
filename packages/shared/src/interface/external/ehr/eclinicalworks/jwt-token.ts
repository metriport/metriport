import z from "zod";
import { EhrSources } from "../source";

export const eclinicalworksDashSource = EhrSources.eclinicalworks as const;
export const eclinicalworksDashJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  patientId: z.string(),
  source: z.literal(`${eclinicalworksDashSource}`),
  aud: z.string(),
});
export type EclinicalworksDashJwtTokenData = z.infer<typeof eclinicalworksDashJwtTokenDataSchema>;
