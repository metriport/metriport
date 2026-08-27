import z from "zod";
import { refreshSourceSuffix, EhrSources } from "../source";

export const practicefusionDashSource = EhrSources.practicefusion as const;
export const practicefusionDashJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  patientId: z.string(),
  source: z.literal(`${practicefusionDashSource}`),
});
export type PracticeFusionDashJwtTokenData = z.infer<typeof practicefusionDashJwtTokenDataSchema>;

export const practicefusionRefreshSource =
  `${EhrSources.practicefusion}${refreshSourceSuffix}` as const;
export const practicefusionRefreshJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  // for background processing (24hr apt, auto write back, etc) - Refresh Token lifespan is 1 year.
  refreshToken: z.string(),
  source: z.literal(`${practicefusionRefreshSource}`),
});
export type PracticefusionRefreshJwtTokenData = z.infer<
  typeof practicefusionRefreshJwtTokenDataSchema
>;
