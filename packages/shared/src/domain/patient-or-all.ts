import { z } from "zod";

const PATIENT_IDS_MIN_LENGTH = 1;

export const patientIdsSchema = z.array(z.string()).min(PATIENT_IDS_MIN_LENGTH);

export const allPatientsSchema = z.object({ allPatients: z.literal(true) }).strict();
export const subsetPatientIdsSchema = z.object({ patientIds: patientIdsSchema }).strict();
export const allOrSubsetPatientIdsSchema = z.union([allPatientsSchema, subsetPatientIdsSchema]);

export function strictlyValidateAllAndPatientIds({
  patientIds,
  allPatients,
}: {
  patientIds: string[] | undefined;
  allPatients: boolean | undefined;
}): void {
  allOrSubsetPatientIdsSchema.parse({
    ...(patientIds ? { patientIds } : {}),
    ...(allPatients ? { allPatients } : {}),
  });
}
