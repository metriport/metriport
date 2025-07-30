import { Bundle, Resource } from "@medplum/fhirtypes";
import { z } from "zod";

const ehrFhirResourceSharedFieldsSchema = z.record(z.string(), z.any());

const ehrFhirBundleSharedFieldsSchema = z.object({
  resourceType: z.literal("Bundle"),
  link: z.object({ relation: z.string(), url: z.string() }).array().optional(),
});

export const ehrFhirResourceSchema = z.intersection(
  z.object({
    id: z.string().optional(),
    resourceType: z.string().optional(),
  }),
  ehrFhirResourceSharedFieldsSchema
);
export type EhrFhirResource = z.infer<typeof ehrFhirResourceSchema>;

export const ehrFhirResourceBundleEntrySchema = z.object({
  resource: ehrFhirResourceSchema.optional(),
});
export type EhrFhirResourceBundleEntry = z.infer<typeof ehrFhirResourceBundleEntrySchema>;

export const ehrFhirResourceBundleSchema = ehrFhirBundleSharedFieldsSchema.extend({
  entry: ehrFhirResourceBundleEntrySchema.array().optional(),
});
export type EhrFhirResourceBundle = z.infer<typeof ehrFhirResourceBundleSchema>;

export const ehrStrictFhirResourceSchema = z.intersection(
  z.object({
    id: z.string(),
    resourceType: z.string(),
  }),
  ehrFhirResourceSharedFieldsSchema
);
export type EhrStrictFhirResource = z.infer<typeof ehrStrictFhirResourceSchema>;

export const ehrStrictFhirResourceBundleEntrySchema = z.object({
  resource: ehrStrictFhirResourceSchema,
});
export type EhrStrictFhirResourceBundleEntry = z.infer<
  typeof ehrStrictFhirResourceBundleEntrySchema
>;

export const ehrStrictFhirResourceBundleSchema = ehrFhirBundleSharedFieldsSchema.extend({
  entry: ehrStrictFhirResourceBundleEntrySchema.array().optional(),
});
export type EhrStrictFhirResourceBundle = z.infer<typeof ehrStrictFhirResourceBundleSchema>;

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
