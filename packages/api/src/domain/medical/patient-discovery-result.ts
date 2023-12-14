import { BaseResultDomain, baseResponseSchema } from "./ihe-result";
import { z } from "zod";

export interface PatientDiscoveryResult extends BaseResultDomain {
  data: PatientDiscoveryResponse;
}

export const patientDiscoveryResponseSchema = baseResponseSchema.extend({
  patientMatch: z.boolean(),
  xcpdHomeCommunityId: z.string().optional(),
  gateway: z.object({ oid: z.string(), url: z.string() }),
});

export type PatientDiscoveryResponse = z.infer<typeof patientDiscoveryResponseSchema>;
