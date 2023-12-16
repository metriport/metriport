import * as z from "zod";
import { demographicsSchema } from "@metriport/api-sdk/medical/models/demographics";
import { addressSchema } from "@metriport/api-sdk/medical/models/common/address";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

const LivingSubjectIdSchema = z.object({
  extension: z.string().optional(),
  root: z.string().optional(),
});

const principalCareProviderIdSchema = z.object({
  extension: z.string().optional(),
  root: z.string().optional(),
});

export type LivingSubjectId = z.infer<typeof LivingSubjectIdSchema>;
export type PrincipalCareProviderId = z.infer<typeof principalCareProviderIdSchema>;

const demographicsSchemaWithOptionalAddress = demographicsSchema.omit({ address: true }).extend({
  address: z.array(addressSchema).optional(),
});

export const PatientDataSchema = demographicsSchemaWithOptionalAddress.merge(
  z.object({
    livingSubjectId: LivingSubjectIdSchema.optional(),
    principalCareProviderId: principalCareProviderIdSchema.optional(),
    id: z.string().optional(),
    systemId: z.string().optional(),
    docmentId: z.string().optional(),
  })
);

export type PatientData = z.infer<typeof PatientDataSchema>;
