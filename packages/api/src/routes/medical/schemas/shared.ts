import { z } from "zod";

const PATIENT_IDS_MIN_LENGTH = 1;

export const patientIdsSchema = z.array(z.string()).min(PATIENT_IDS_MIN_LENGTH);

export const allOrSubsetPatientIdsSchema = z.discriminatedUnion("all", [
  z.object({
    all: z.literal(true),
    patientIds: z.undefined().optional(),
  }),
  z.object({
    all: z.undefined(),
    patientIds: patientIdsSchema,
  }),
]);

export type AllOrSubsetPatientIds = z.infer<typeof allOrSubsetPatientIdsSchema>;

export function strictlyValidateAllAndPatientIds({
  patientIds,
  all,
}: {
  patientIds: string[] | undefined;
  all: boolean | undefined;
}): void {
  allOrSubsetPatientIdsSchema.parse({ patientIds, all });
}
