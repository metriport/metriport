import { Bundle, Resource } from "@medplum/fhirtypes";
import { z } from "zod";

export const ehrFhirResourceSchema = z.intersection(
  z.object({
    id: z.string(),
    resourceType: z.string(),
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

export const fhirOperationOutcomeIssueSchema = z.object({
  severity: z.string(),
  code: z.string(),
  details: z.object({
    text: z.string(),
  }),
});
export type FhirOperationOutcomeIssue = z.infer<typeof fhirOperationOutcomeIssueSchema>;
export const fhirOperationOutcomeSchema = z.object({
  resourceType: z.literal("OperationOutcome"),
  issue: fhirOperationOutcomeIssueSchema.array(),
});
export type FhirOperationOutcome = z.infer<typeof fhirOperationOutcomeSchema>;
