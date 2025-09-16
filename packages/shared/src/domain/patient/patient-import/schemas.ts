import { z } from "zod";
import { patientImportJobStatus } from "./status";

// TODO 2330 Review this as part of POST /internal/patient/bulk/coverage-assessment
// export const patientImportPatientSchema = z.object({
//   dob: z.string().refine(normalizeDobSafe, { message: "Invalid dob" }),
//   gender: z.string().refine(normalizeGenderSafe, { message: "Invalid gender" }),
//   firstname: z.string().min(1, { message: "First name must be defined" }),
//   lastname: z.string().min(1, { message: "Last name must be defined" }),
//   zip: z.string().refine(normalizeZipCodeNewSafe, { message: "Invalid zip" }),
//   city: z.string().min(1, { message: "City must be defined" }),
//   state: z
//     .string()
//     .refine(normalizeUSStateForAddressSafe, { message: "Invalid state or territory" }),
//   addressline1: z.string().min(1, { message: "Address line must be defined" }),
//   addressline2: z.string().optional(),
//   phone1: z.string().refine(isPhoneValid, { message: "Invalid phone" }).optional(),
//   phone2: z.string().refine(isPhoneValid, { message: "Invalid phone" }).optional(),
//   email1: z.string().refine(isEmailValid, { message: "Invalid email" }).optional(),
//   email2: z.string().refine(isEmailValid, { message: "Invalid email" }).optional(),
//   externalid: z.string().optional(),
// });
// export type PatientImportPatient = z.infer<typeof patientImportPatientSchema>;

// export const patientImportSchema = z.object({
//   patients: patientImportPatientSchema.array(),
// });

export const updateJobSchema = z.object({
  status: z
    .enum(patientImportJobStatus.filter(s => s !== "waiting") as [string, ...string[]])
    .optional(),
  total: z.number().optional(),
  /**
   * Only to be set on dry run mode - on regular mode, the successful count is incremented
   * individually as each patient is created.
   */
  successful: z.number().optional(),
  failed: z.number().optional(),
  reason: z.string().optional(),
  forceStatusUpdate: z.boolean().optional(),
});
export type UpdateJobSchema = z.infer<typeof updateJobSchema>;

export const addPatientMappingSchema = z.object({
  cxId: z.string(),
  rowNumber: z.number(),
  patientId: z.string(),
  dataPipelineRequestId: z.string(),
});
export type AddPatientMappingSchema = z.infer<typeof addPatientMappingSchema>;
