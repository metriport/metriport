import { Resource } from "@medplum/fhirtypes";
import { z } from "zod";

export const fhirResourceSchema = z.intersection(
  z.object({
    id: z.string(),
    resourceType: z.string() as z.ZodType<SupportedResourceType>,
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
  link: z.object({ relation: z.string(), url: z.string() }).array().optional(),
});
export type FhirResourceBundle = z.infer<typeof fhirResourceBundleSchema>;

export type SupportedResourceType = Resource["resourceType"];

export type BundleWithLastModified = {
  bundle: {
    resourceType: "Bundle";
    entry: {
      resource: FhirResource;
    }[];
  };
  lastModified: Date | undefined;
};

export type Bundle = BundleWithLastModified["bundle"];

export function createBundleFromResourceList(resourceList: FhirResource[]): Bundle {
  return {
    resourceType: "Bundle",
    entry: resourceList.map(resource => ({ resource })),
  };
}

export function getDefaultBundle(): Bundle {
  return {
    resourceType: "Bundle",
    entry: [],
  };
}
