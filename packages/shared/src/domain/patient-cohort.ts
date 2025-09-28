import { z } from "zod";
import { BaseDomain } from "./base-domain";

// PatientCohort Base Interface
export const patientCohortSchema = z.object({
  patientId: z.string(),
  cohortId: z.string(),
});
export type BasePatientCohort = z.infer<typeof patientCohortSchema>;

export const patientCohortCreateSchema = patientCohortSchema;
export const patientCohortUpdateSchema = patientCohortCreateSchema.partial();

// PatientCohort Command Interfaces
export type PatientCohortUpdateCmd = z.infer<typeof patientCohortUpdateSchema>;
export type PatientCohortCreateCmd = z.infer<typeof patientCohortCreateSchema>;

// PatientCohort Interface
export type PatientCohort = BasePatientCohort & BaseDomain & { cxId: string };
