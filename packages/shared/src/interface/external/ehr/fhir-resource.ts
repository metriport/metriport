import { z } from "zod";
export const fhirResourceSchema = z.intersection(
  z.object({
    id: z.string(),
    resourceType: z.string(),
  }),
  z.record(z.string(), z.any())
);
export type FhirResource = z.infer<typeof fhirResourceSchema>;

export const fhirResourcesSchema = fhirResourceSchema.array();
export type FhirResources = z.infer<typeof fhirResourcesSchema>;
