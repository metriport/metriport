import { z } from "zod";
import { createNonEmptryStringSchema } from "../../common/string";
import { demographicsSchema } from "./demographics";

export const patientDtoSchema = demographicsSchema.merge(
  z.object({
    id: createNonEmptryStringSchema("id"),
    externalId: z.string().nullish(),
  })
);
export type PatientDTO = z.infer<typeof patientDtoSchema>;

export const patientDiscoveryDtoSchema = z.object({
  requestId: createNonEmptryStringSchema("requestId"),
});

export const patientDocumentQueryDtoSchema = z.object({
  requestId: createNonEmptryStringSchema("requestId"),
});
