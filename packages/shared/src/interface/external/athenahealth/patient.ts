import { z } from "zod";

export const patientCustomFieldSchema = z.object({
  customfieldid: z.string(),
  customfieldvalue: z.string(),
  optionid: z.string(),
});
export type PatientCustomField = z.infer<typeof patientCustomFieldSchema>;
export const patientCustomFieldsSchema = z.object({
  customfields: patientCustomFieldSchema.array(),
});
export type PatientCustomFields = z.infer<typeof patientCustomFieldsSchema>;
