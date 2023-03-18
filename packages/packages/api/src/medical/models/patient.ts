import { z } from "zod";
import { demographicsSchema } from "./demographics";
import { linkStatusAcrossHIEsSchema } from "./link";

export const patientCreateSchema = demographicsSchema;
export type PatientCreate = z.infer<typeof patientCreateSchema>;

export const patientUpdateSchema = patientCreateSchema.extend({
  id: z.string(),
});
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export const patientSchema = patientUpdateSchema.extend({
  facilityIds: z.array(z.string()),
  links: linkStatusAcrossHIEsSchema,
});
export type Patient = z.infer<typeof patientSchema>;

export const patientListSchema = z.object({
  patients: z.array(patientSchema),
});
