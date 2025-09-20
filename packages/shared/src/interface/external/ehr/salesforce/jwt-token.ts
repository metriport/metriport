import z from "zod";
import { EhrSources } from "../source";

export const salesforceDashSource = EhrSources.salesforce as const;
export const salesforceDashJwtTokenDataSchema = z.object({
  practiceId: z.string(),
  instanceUrl: z.string(),
  patientId: z.string(),
  source: z.literal(`${salesforceDashSource}`),
});
export type SalesforceDashJwtTokenData = z.infer<typeof salesforceDashJwtTokenDataSchema>;
