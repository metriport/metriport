import { z } from "zod";

export const patientCustomFieldSchema = z.object({
  customfieldid: z.string(),
  customfieldvalue: z.string().optional(),
  optionid: z.string().optional(),
});
export type PatientCustomField = z.infer<typeof patientCustomFieldSchema>;
export const athenaOnePatientSchema = z.object({
  customfields: patientCustomFieldSchema.array(),
  departmentid: z.string(),
});
export type AthenaOnePatient = z.infer<typeof athenaOnePatientSchema>;
export const athenaOnePatientsSchema = athenaOnePatientSchema.array();
export type AthenaOnePatients = z.infer<typeof athenaOnePatientsSchema>;
