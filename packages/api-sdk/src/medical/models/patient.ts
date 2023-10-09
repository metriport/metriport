import { z } from "zod";
import { baseUpdateSchema } from "./common/base-update";
import { demographicsSchema, lenientDemographicsSchema } from "./demographics";

export const patientCreateSchema = demographicsSchema;
export type PatientCreate = z.infer<typeof patientCreateSchema>;

export const lenientPatientCreateSchema = lenientDemographicsSchema;
export type LenientPatientCreate = z.infer<typeof lenientPatientCreateSchema>;

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

export const queryProgressSchema = z.object({
  status: queryStatusSchema,
});
export type QueryProgress = z.infer<typeof queryProgressSchema>;
