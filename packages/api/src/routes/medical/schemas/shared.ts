import { z } from "zod";

const PATIENT_IDS_MIN_LENGTH = 1;

export const patientIdsSchema = z.array(z.string()).min(PATIENT_IDS_MIN_LENGTH);

export const allOrSubsetPatientIdsSchema = z.union([
  z.object({
    allPatients: z.literal(true),
  }),
  z.object({
    patientIds: patientIdsSchema,
  }),
]);
