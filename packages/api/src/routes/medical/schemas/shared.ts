import { z } from "zod";

export const allOrSelectPatientIdsSchema = z.object({
  patientIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export const allOrSelectPatientIdsRefinedSchema = allOrSelectPatientIdsSchema
  .refine(data => data.patientIds || data.all, {
    message: "Either patientIds or all must be provided",
  })
  .refine(data => !data.patientIds || data.patientIds.length > 0, {
    message: "patientIds must be an array of patient IDs",
  })
  .refine(data => !(data.patientIds && data.all), {
    message: "patientIds and all cannot be provided together",
  });

export function strictlyValidateAllAndPatientIds({
  patientIds,
  all,
}: {
  patientIds: string[] | undefined;
  all: boolean | undefined;
}): void {
  allOrSelectPatientIdsRefinedSchema.parse({ patientIds, all });
}
