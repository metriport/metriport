import { z } from "zod";
import { baseUpdateSchema } from "./common/base-update";
import { demographicsSchema } from "./demographics";
import { ConsolidatedQuery } from "./fhir";

export const patientCreateSchema = demographicsSchema.merge(
  z.object({
    externalId: z.string().optional(),
  })
);
export type PatientCreate = z.infer<typeof patientCreateSchema>;

export const patientUpdateSchema = patientCreateSchema.merge(baseUpdateSchema);
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export const patientSchema = patientUpdateSchema.extend({
  facilityIds: z.array(z.string()),
});
export type Patient = z.infer<typeof patientSchema>;

export const patientListSchema = z.object({
  patients: z.array(patientSchema),
});

export const queryStatusSchema = z.enum(["processing", "completed", "failed"]);
export type QueryStatus = z.infer<typeof queryStatusSchema>;

export type GetConsolidatedQueryProgressResponse = {
  /** @deprecated status should no longer be used. Refer to queries array instead. */
  status: QueryStatus;
  queries: ConsolidatedQuery[] | null;
  message?: string;
};

export type StartConsolidatedQueryProgressResponse = ConsolidatedQuery;

export type PatientHieOptOutResponse = {
  id: string;
  hieOptOut: boolean;
  message: string;
};
