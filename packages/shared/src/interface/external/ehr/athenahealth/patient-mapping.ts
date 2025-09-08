import { z } from "zod";
import { patientMappingSecondaryMappingsSchema } from "../shared";

export const athenaPatientMappingSecondaryMappingsSchema = z
  .object({
    departmentId: z.string().optional(),
  })
  .merge(patientMappingSecondaryMappingsSchema);
export type AthenaPatientMappingSecondaryMappings = z.infer<
  typeof athenaPatientMappingSecondaryMappingsSchema
>;
