import { paginationMetaSchema } from "@metriport/shared/domain/pagination";
import { patientSchema } from "@metriport/shared/domain/patient";
import { z } from "zod";

export const questRosterResponseSchema = z.object({
  patients: z.array(patientSchema),
  meta: paginationMetaSchema,
});

export type QuestRosterResponse = z.infer<typeof questRosterResponseSchema>;
