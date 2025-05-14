import { Bundle, Resource } from "@medplum/fhirtypes";
import { z } from "zod";
import { resourceTypeForConsolidation } from "../../../medical/fhir/resources";

export const supportedResourceTypes = [...resourceTypeForConsolidation] as const;

export type SupportedResourceType = (typeof supportedResourceTypes)[number];

export const ehrFhirResourceSchema = z.intersection(
  z.object({
    id: z.string(),
    resourceType: z.enum(supportedResourceTypes),
  }),
  z.record(z.string(), z.any())
);
export type EhrFhirResource = z.infer<typeof ehrFhirResourceSchema>;

export const ehrFhirResourcesSchema = ehrFhirResourceSchema.array();
export type EhrFhirResources = z.infer<typeof ehrFhirResourcesSchema>;

export const ehrFhirResourceWrapperSchema = z.object({
  resource: ehrFhirResourceSchema,
});
export type EhrFhirResourceWrapper = z.infer<typeof ehrFhirResourceWrapperSchema>;

export const ehrFhirResourceBundleSchema = z.object({
  resourceType: z.literal("Bundle"),
  entry: ehrFhirResourceWrapperSchema.array().optional(),
  link: z.object({ relation: z.string(), url: z.string() }).array().optional(),
});
export type EhrFhirResourceBundle = z.infer<typeof ehrFhirResourceBundleSchema>;

export type BundleWithLastModified = {
  bundle: Bundle;
  lastModified: Date | undefined;
};

export function createBundleFromResourceList(resourceList: Resource[]): Bundle {
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
