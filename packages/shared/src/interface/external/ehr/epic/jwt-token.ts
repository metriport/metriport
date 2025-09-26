import z from "zod";
import { EhrSources } from "../source";

export const epicDashSource = EhrSources.epic as const;
export const epicDashJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  instanceUrl: z.string(),
  patientId: z.string(),
  source: z.literal(`${epicDashSource}`),
});
export type EpicDashJwtTokenData = z.infer<typeof epicDashJwtTokenDataSchema>;
