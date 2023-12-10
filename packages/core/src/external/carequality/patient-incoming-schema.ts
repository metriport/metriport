import * as z from "zod";
import { demographicsSchema } from "@metriport/api-sdk/medical/models/demographics";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

const LivingSubjectIdSchema = z.object({
  extension: z.string(),
  root: z.string(),
});

const principalCareProviderIdSchema = z.object({
  extension: z.string(),
  root: z.string(),
});

export type LivingSubjectId = z.infer<typeof LivingSubjectIdSchema>;
export type PrincipalCareProviderId = z.infer<typeof principalCareProviderIdSchema>;

export const PatientDataSchema = demographicsSchema.merge(
  z.object({
    livingSubjectId: LivingSubjectIdSchema.optional(),
    principalCareProviderId: principalCareProviderIdSchema.optional(),
    id: z.string().optional(),
    systemId: z.string().optional(),
    docmentId: z.string().optional(),
  })
);
export type PatientData = z.infer<typeof PatientDataSchema>;
