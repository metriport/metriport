import { z } from "zod";

export const createdMedicationSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  medicationentryid: z.coerce.string().optional(),
});
export type CreatedMedication = z.infer<typeof createdMedicationSchema>;
export const createdMedicationSuccessSchema = z.object({
  success: z.literal(true),
  medicationentryid: z.coerce.string(),
});
export type CreatedMedicationSuccess = z.infer<typeof createdMedicationSuccessSchema>;

const medicationReferenceSchema = z.object({
  medication: z.string(),
  medicationid: z.coerce.string(),
});
export type MedicationReference = z.infer<typeof medicationReferenceSchema>;
export const medicationReferencesSchema = medicationReferenceSchema.array();
export type MedicationReferences = z.infer<typeof medicationReferencesSchema>;

export type MedicationCreateParams = {
  departmentid: string;
  providernote: string;
  unstructuredsig: string;
  medicationid: string;
  hidden: boolean;
  startdate: string;
  stopdate: string | undefined;
  stopreason: string | undefined;
  patientnote: string | undefined;
  THIRDPARTYUSERNAME: string | undefined;
  PATIENTFACINGCALL: string | undefined;
};
