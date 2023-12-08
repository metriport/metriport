import * as z from "zod";
import { demographicsSchema } from "@metriport/api-sdk/medical/models/demographics";

export const PatientDataSchema = demographicsSchema.merge(
  z.object({
    externalId: z.string().optional(),
  })
);

// different from normal Patient in sdk since this patient has no facilityIds
export type PatientData = z.infer<typeof PatientDataSchema>;
