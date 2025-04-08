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

export const fhirResourceWrapperSchema = z.object({
  resource: fhirResourceSchema,
});
export type FhirResourceWrapper = z.infer<typeof fhirResourceWrapperSchema>;

export const fhirResourceBundleSchema = z.object({
  resourceType: z.literal("Bundle"),
  entry: fhirResourceWrapperSchema.array().optional(),
});
export type FhirResourceBundle = z.infer<typeof fhirResourceBundleSchema>;
