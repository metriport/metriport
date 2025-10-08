import { z } from "zod";
import { baseDomainCreateSchema, baseDomainSchema } from "./base-domain";
// import { BaseDomain, BaseDomainCreate } from "./base-domain";

// export type MonitoringSettings = {
//   adt?: boolean;
// };

// export interface CohortCreate extends BaseDomainCreate {
//   cxId: string;
//   name: string;
//   monitoring?: MonitoringSettings;
// }

// export interface Cohort extends BaseDomain, CohortCreate {}

// export interface PatientCohortData {
//   patientId: string;
//   cohortId: string;
// }

// export interface PatientCohortCreate extends PatientCohortData {
//   cxId: string;
// }

// export interface PatientCohort extends BaseDomain, Required<PatientCohortData> {}

const COHORT_COLORS = [
  "red",
  "green",
  "blue",
  "yellow",
  "purple",
  "orange",
  "pink",
  "brown",
  "gray",
  "black",
  "white",
] as const;
export const cohortColorsSchema = z.enum(COHORT_COLORS);
export type CohortColors = z.infer<typeof cohortColorsSchema>;

// Cohort Domain Interface
export const cohortSettingsSchema = z.object({
  adtMonitoring: z.boolean().optional(),
});
export type CohortSettings = z.infer<typeof cohortSettingsSchema>;

export const cohortSchema = z.object({
  name: z.string().transform(val => val.trim()),
  color: cohortColorsSchema,
  description: z.string(),
  settings: cohortSettingsSchema,
});
export type Cohort = z.infer<typeof cohortSchema>;

export const cohortCreateSchema = cohortSchema.extend({
  description: z.string().optional(),
  settings: cohortSettingsSchema.optional(),
});
export type CohortCreate = z.infer<typeof cohortCreateSchema>;

export const cohortUpdateSchema = cohortCreateSchema.partial();
export type CohortUpdate = z.infer<typeof cohortUpdateSchema>;

// Cohort Model Interface
export const cohortModelSchema = cohortSchema
  .and(baseDomainSchema)
  .and(z.object({ cxId: z.string() }));
export type CohortEntity = z.infer<typeof cohortModelSchema>;

export const cohortModelCreateSchema = cohortCreateSchema
  .and(baseDomainCreateSchema)
  .and(z.object({ cxId: z.string() }));
export type CohortModelCreate = z.infer<typeof cohortModelCreateSchema>;

export const cohortModelUpdateSchema = cohortUpdateSchema
  .and(baseDomainCreateSchema)
  .and(z.object({ cxId: z.string() }));
export type CohortModelUpdate = z.infer<typeof cohortModelUpdateSchema>;

// PatientCohort Domain Interface
export const patientCohortSchema = z.object({
  patientId: z.string(),
  cohortId: z.string(),
});
export type PatientCohort = z.infer<typeof patientCohortSchema>;

export const patientCohortCreateSchema = patientCohortSchema;
export type PatientCohortCreate = z.infer<typeof patientCohortCreateSchema>;

export const patientCohortUpdateSchema = patientCohortCreateSchema.partial();
export type PatientCohortUpdate = z.infer<typeof patientCohortUpdateSchema>;

// PatientCohort Model Interface
export const patientCohortModelCreateSchema = patientCohortCreateSchema.and(baseDomainCreateSchema);
export type PatientCohortModelCreate = z.infer<typeof patientCohortModelCreateSchema>;

export const patientCohortModelUpdateSchema = patientCohortUpdateSchema.and(baseDomainCreateSchema);
export type PatientCohortModelUpdate = z.infer<typeof patientCohortModelUpdateSchema>;
