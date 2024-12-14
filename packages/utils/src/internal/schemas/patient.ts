import { z } from "zod";
import { addressStrictSchema } from "./address";

const coverageAssessmentPatientSchema = z.object({
  dob: z.string().optional(),
  gender: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  addressline1: z.string().optional(),
  addressline2: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  email1: z.string().optional(),
  email2: z.string().optional(),
  externalid: z.string().optional(),
});

const coverageAssessmentSchema = z.object({
  patients: coverageAssessmentPatientSchema.array(),
});
export type CoverageAssessment = z.infer<typeof coverageAssessmentSchema>;

const patientCoverageSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string(),
  address: addressStrictSchema.array(),
  downloadStatus: z.string().optional(),
  docCount: z.number().optional(),
  convertStatus: z.string().optional(),
  fhirCount: z.number(),
  fhirDetails: z.string(),
  mrSummaryUrl: z.string().optional(),
});
export type PatientCoverage = z.infer<typeof patientCoverageSchema>;

export const patientCoverageResponseSchema = z.object({
  patientsWithAssessments: patientCoverageSchema.array(),
});
export type PatientCoverageResponse = z.infer<typeof patientCoverageResponseSchema>;
