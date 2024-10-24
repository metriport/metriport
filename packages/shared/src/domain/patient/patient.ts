import { z } from "zod";
import { nonEmptyStringSchema } from "../../common/string";
import { demographicsSchema } from "./demographics";

export const patientDtoSchema = demographicsSchema.merge(
  z.object({
    id: nonEmptyStringSchema,
    externalId: nonEmptyStringSchema.optional(),
  })
);
export type PatientDTO = z.infer<typeof patientDtoSchema>;

export const patientDiscoveryDtoSchema = z.object({
  requestId: nonEmptyStringSchema,
});

export const patientDocumentQueryDtoSchema = z.object({
  requestId: nonEmptyStringSchema,
});
