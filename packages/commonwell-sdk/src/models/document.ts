import { z } from "zod";
import { addressSchema } from "./address";
import { genderSchema } from "./demographics";
import { humanNameSchema } from "./human-name";
import { identifierUseCodesSchema } from "./identifier";
import { isoDateTimeSchema } from "./iso-datetime";
import { periodSchema } from "./period";

// Used as a reference, but not exactly the actual definition:
// https://specification.commonwellalliance.org/services/rest-api-reference#8610-documentreference

// TODO can this be an enum?
// Bundle, DocumentReference, Organization, Practitioner, OperationOutcome
const resourceTypeSchema = z.string().optional();

// TODO we should try to reuse identifierSchema from models/identifier instead
// TODO try to replace this when we can properly test it
const identifierSchema = z.object({
  use: identifierUseCodesSchema.optional(),
  system: z.string().optional(),
  value: z.string(),
});
export type DocumentIdentifier = z.infer<typeof identifierSchema>;

const codeableConceptSchema = z.object({
  coding: z
    .array(
      z.object({
        system: z.string().optional(),
        code: z.string().optional(),
        display: z.string().optional(),
      })
    )
    .optional(),
  text: z.string().optional(),
});
export type CodeableConcept = z.infer<typeof codeableConceptSchema>;

const containedAddress = addressSchema.partial({
  zip: true,
});

const containedSchema = z.object({
  resourceType: resourceTypeSchema,
  id: z.string().nullish(),
  identifier: z.array(identifierSchema).nullish(),
  name: z.string().or(humanNameSchema).or(z.array(humanNameSchema)).nullish(),
  organization: z
    .object({
      reference: z.string(),
    })
    .nullish(),
  gender: z
    .object({
      coding: z.array(genderSchema).optional(),
    })
    .nullish(),
  birthDate: z.string().nullish(),
  address: z.array(containedAddress).nullish(),
});
export type Contained = z.infer<typeof containedSchema>;

const statusSchema = z.enum(["current", "superceded", "entered in error"]);
export type DocumentStatus = z.infer<typeof statusSchema>;

// Main Clinical Acts Documented
const eventSchema = codeableConceptSchema;

// https://specification.commonwellalliance.org/services/rest-api-reference#8610-documentreference
export const contentSchema = z.object({
  // _links: resourceTypeSchema, // What's the structure here? -	A reserved property for presenting the link relations for this resource.
  resourceType: resourceTypeSchema,
  contained: z.array(containedSchema).nullish(),
  masterIdentifier: identifierSchema,
  identifier: z.array(identifierSchema).optional(),
  subject: z.object({
    reference: z.string(), // Supposed to be one of these, but sandbox doesn't match it: Patient | Practitioner | Group | Device
  }),
  type: codeableConceptSchema,
  // class: ?, // Likely a codeableConceptSchema like 'type'?
  author: z
    .array(
      z.object({
        reference: z.string(), // Supposed to be one of these, but sandbox doesn't match it: Practitioner | Device | Patient | RelatedPerson
      })
    )
    .optional(),
  // custodian: ?, // It's an Organization, but what data are we going to get here, a simple or strong ID?
  // policyManager: ?, // URI, just a simple string/URI, or object with an inner property?
  // authenticator: ?, // same structure as 'author' with diff options, or diff structure?
  // created: ?, // isoDateTimeSchema, like 'indexed'?
  indexed: isoDateTimeSchema,
  status: statusSchema,
  // docStatus: preliminary | final | appended | amended | entered in error, // What's the structure here? Maybe based on codeableConceptSchema?
  // relatesTo: ?, // What's the structure here?
  // code: replaces | transforms | signs | appends, // Supposed to be required, no example - what's the structure here?
  // target: ?, // Supposed to be required, no example - what's the structure here?
  description: z.string().optional(),
  // confidentiality: ?[], // What's the structure here? Maybe based on codeableConceptSchema?
  // primaryLanguage: ?, // What's the structure here?
  mimeType: z.string().optional(),
  format: z.string().or(z.array(z.string())).optional(), // URI - Format/content rules for the document
  size: z.number().optional(), // Size of the document in bytes
  hash: z.string().optional(), // Base64 representation of SHA-256
  location: z.string().optional(), // URI - Where to access the document
  // What's the structure here? Assuming based on logic/docs
  // service: z
  //   .object({
  //     type: codeableConceptSchema, // Assuming the structure matches this schema - Type of service (i.e. XDS.b)
  //     address: z.string().optional(), // Where service is located (usually a URL)
  //     parameter: z // Service call parameters
  //       .array(
  //         z.object({
  //           name: z.string(), // Parameter name in service call
  //           value: z.string().optional(), // Parameter value for the name
  //         })
  //       )
  //       .optional(),
  //   })
  //   .optional(),
  context: z.object({
    event: z.array(eventSchema).optional(),
    period: periodSchema.optional(),
    facilityType: codeableConceptSchema.optional(), // Kind of facility where patient was seen
  }),
});
export type DocumentContent = z.infer<typeof contentSchema>;

export const documentSchema = z.object({
  id: z.string(),
  content: contentSchema,
});
export type Document = z.infer<typeof documentSchema>;

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

export const documentQueryResponseIncomingSchema = z.object({
  resourceType: resourceTypeSchema,
  entry: z.preprocess(entries => {
    const result = z.array(z.any()).parse(entries);
    return result.filter(e => e.content?.resourceType === documentReferenceResourceType);
  }, z.array(documentSchema)),
});

export type DocumentQueryResponse = z.infer<typeof documentQueryResponseIncomingSchema>;

export const documentQueryFullResponseSchema = z.object({
  resourceType: resourceTypeSchema,
  entry: z.preprocess(entries => {
    const result = z.array(z.any()).parse(entries);
    return result.filter(
      e =>
        e.content?.resourceType === documentReferenceResourceType ||
        e.content?.resourceType === operationOutcomeResourceType
    );
  }, z.array(documentSchema.or(operationOutcomeSchema))),
});

export type DocumentQueryFullResponse = z.infer<typeof documentQueryFullResponseSchema>;
