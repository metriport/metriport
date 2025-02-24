import { z } from "zod";

export const patientCustomFieldSchema = z.object({
  customfieldid: z.string(),
  customfieldvalue: z.string(),
  optionid: z.string().optional(),
});
export type PatientCustomField = z.infer<typeof patientCustomFieldSchema>;
export const patientsCustomFieldsSchema = z
  .object({
    customfields: patientCustomFieldSchema.array(),
  })
  .array();
export type PatientsCustomFields = z.infer<typeof patientsCustomFieldsSchema>;
