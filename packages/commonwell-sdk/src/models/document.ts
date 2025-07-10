import { zodToLowerCase } from "@metriport/shared/util/zod";
import { z } from "zod";
import { dateStringToIsoDateString, isoDateSchema, usDateSchema } from "./date";
import { identifierSchema } from "./identifier";
import { periodSchema } from "./period";
import { referenceSchema } from "./reference";

// Based on https://www.hl7.org/fhir/R4/documentreference.html

const resourceTypeSchema = z.string().optional();

const codingSchema = z.object({
  system: z.string().optional(),
  code: z.string().optional(),
  display: z.string().optional(),
});
export type Coding = z.infer<typeof codingSchema>;

const codeableConceptSchema = z.object({
  coding: z.array(codingSchema).optional(),
  text: z.string().optional(),
});
export type CodeableConcept = z.infer<typeof codeableConceptSchema>;

const statusSchema = z.preprocess(
  zodToLowerCase,
  z.enum(["current", "superseded", "entered-in-error"])
);
export type DocumentStatus = z.infer<typeof statusSchema>;

const attachmentSchema = z.object({
  contentType: z.string().nullish(),
  data: z.string().nullish(),
  url: z.string().nullish(),
  size: z.number().nullish(),
  hash: z.string().nullish(),
  title: z.string().nullish(),
  creation: isoDateSchema.or(usDateSchema).transform(dateStringToIsoDateString).nullish(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

const contentSchema = z.object({
  attachment: attachmentSchema,
  format: codingSchema.nullish(),
});
export type Content = z.infer<typeof contentSchema>;

const docStatusSchema = z.preprocess(
  zodToLowerCase,
  z.enum(["preliminary", "final", "amended", "entered-in-error"])
);
export type DocStatus = z.infer<typeof docStatusSchema>;

export const documentReferenceSchema = z.object({
  resourceType: z.literal("DocumentReference"),
  id: z.string().nullish(),
  masterIdentifier: identifierSchema.nullish(),
  identifier: z.array(identifierSchema).nullish(),
  status: statusSchema,
  docStatus: docStatusSchema.nullish(),
  type: codeableConceptSchema.nullish(),
  category: z.array(codeableConceptSchema).nullish(),
  subject: referenceSchema.nullish(),
  custodian: referenceSchema.nullish(),
  contained: z.array(z.any()).nullish(), // FHIR resources
  description: z.string().nullish(),
  content: z.array(contentSchema),
  context: z
    .object({
      encounter: referenceSchema.nullish(),
      event: codeableConceptSchema.nullish(),
      period: periodSchema.nullish(),
      facilityType: codeableConceptSchema.nullish(),
      practiceSetting: codeableConceptSchema.nullish(),
      sourcePatientInfo: referenceSchema.nullish(),
      related: z.array(z.any()).nullish(),
    })
    .nullish(),
});
export type DocumentReference = z.infer<typeof documentReferenceSchema>;

export const documentReferenceEntrySchema = z.object({
  fullUrl: z.string().optional(),
  resource: documentReferenceSchema.nullish(),
});
export type DocumentReferenceEntry = z.infer<typeof documentReferenceEntrySchema>;

export const operationOutcomeSchema = z.object({
  id: z.string(),
  content: z.object({
    resourceType: resourceTypeSchema,
    issue: z
      .array(
        z.object({
          severity: z.string(),
          type: z
            .object({
              code: z.string(),
            })
            .optional()
            .nullable(),
          details: z.string(),
        })
      )
      .nullish(),
  }),
});
export type OperationOutcome = z.infer<typeof operationOutcomeSchema>;

export const documentReferenceResourceType = "DocumentReference";
export const operationOutcomeResourceType = "OperationOutcome";

export const documentQueryResponseSchema = z.object({
  resourceType: z.literal("Bundle"),
  entry: z.preprocess(entries => {
    const result = z.array(z.any()).parse(entries);
    return result.filter(e => e.resource?.resourceType === documentReferenceResourceType);
  }, z.array(documentReferenceEntrySchema)),
});

export type DocumentQueryResponse = z.infer<typeof documentQueryResponseSchema>;

export const documentQueryFullResponseSchema = z.object({
  resourceType: z.literal("Bundle"),
  entry: z.preprocess(entries => {
    const result = z.array(z.any()).parse(entries);
    return result.filter(
      e =>
        e.resource?.resourceType === documentReferenceResourceType ||
        e.resource?.resourceType === operationOutcomeResourceType
    );
  }, z.array(documentReferenceEntrySchema.or(operationOutcomeSchema))),
});

export type DocumentQueryFullResponse = z.infer<typeof documentQueryFullResponseSchema>;
