import { z } from "zod";

export const patientCohortAssignmentSchema = z.object({
  cohortId: z.string(),
});
