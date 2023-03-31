import { z } from "zod";
import { humanNameSchema } from "./human-name";
import { identifierUseCodesSchema } from "./identifier";
import { isoDateTimeSchema } from "./iso-datetime";
import { periodSchema } from "./period";
import { addressSchema } from "./address";
import { genderSchema } from "./demographics";

// Used as a reference, but not exactly the actual definition:
// https://specification.commonwellalliance.org/services/rest-api-reference#8610-documentreference

// TODO can this be an enum?
// Bundle, DocumentReference, Organization, Practitioner
const resourceTypeSchema = z.string().optional();

const identifierSchema = z.object({
  use: identifierUseCodesSchema.optional(),
  system: z.string().optional(),
  value: z.string(),
});

const codeableConceptSchema = z.object({
  coding: z
    .array(
      z.object({
        system: z.string().optional().nullable(),
        code: z.string().optional().nullable(),
        display: z.string().optional().nullable(),
      })
    )
    .optional(),
  text: z.string().optional(),
});

const containedSchema = z.object({
  resourceType: resourceTypeSchema,
  id: z.string(),
  identifier: z.array(identifierSchema).optional(),
  name: z.string().or(humanNameSchema).or(z.array(humanNameSchema)).optional(),
  organization: z
    .object({
      reference: z.string(),
    })
    .optional(),
  gender: z
    .object({
      coding: z.array(genderSchema).optional(),
    })
    .optional(),
  birthDate: z.string().optional(),
  address: z.array(addressSchema).optional(),
});

const statusSchema = z.enum(["current", "superceded", "entered in error"]);
export type DocumentStatus = z.infer<typeof statusSchema>;

// Main Clinical Acts Documented
const eventSchema = codeableConceptSchema;

// https://specification.commonwellalliance.org/services/rest-api-reference#8610-documentreference
export const contentSchema = z.object({
  // _links: resourceTypeSchema, // What's the structure here? -	A reserved property for presenting the link relations for this resource.
  resourceType: resourceTypeSchema,
  contained: z.array(containedSchema),
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
  description: z.string().optional().nullable(),
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

export const documentQueryResponseSchema = z.object({
  resourceType: resourceTypeSchema,
  entry: z.preprocess(entries => {
    const result = z.array(z.any()).parse(entries);
    return result.filter(e => e.content?.resourceType === "DocumentReference");
  }, z.array(documentSchema)),
});

export type DocumentQueryResponse = z.infer<typeof documentQueryResponseSchema>;
