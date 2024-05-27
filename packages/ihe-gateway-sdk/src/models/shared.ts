import { z } from "zod";
import { validateNPI, normalizeOid } from "@metriport/shared";

export const npiStringSchema = z
  .string()
  .length(10)
  .refine(npi => validateNPI(npi), { message: "NPI is not valid" });

export type NPIString = z.infer<typeof npiStringSchema>;

export const npiStringArraySchema = z.array(npiStringSchema);

export type NPIStringArray = z.infer<typeof npiStringArraySchema>;

export const oidStringSchema = z
  .string()
  .refine(oid => normalizeOid(oid), { message: "OID is not valid" });

export const SamlAttributesSchema = z.object({
  subjectId: z.string(),
  subjectRole: z.object({
    display: z.string(),
    code: z.string(),
  }),
  organization: z.string(),
  organizationId: z.string(),
  homeCommunityId: z.string(),
  purposeOfUse: z.string(),
});
export type SamlAttributes = z.infer<typeof SamlAttributesSchema>;

export const baseRequestSchema = z.object({
  id: z.string(),
  cxId: z.string().optional(),
  timestamp: z.string(),
  samlAttributes: SamlAttributesSchema,
  patientId: z.string().nullish(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export const codeSchema = z.object({
  system: z.string(),
  code: z.string(),
});

export type Code = z.infer<typeof codeSchema>;

export const detailsSchema = z.union([
  z.object({ coding: z.array(codeSchema) }),
  z.object({ text: z.string() }),
]);

export type Details = z.infer<typeof detailsSchema>;

export const issueSchema = z.object({
  severity: z.string(),
  code: z.string(),
  details: detailsSchema,
});
export type Issue = z.infer<typeof issueSchema>;

export const operationOutcomeSchema = z.object({
  resourceType: z.string(),
  id: z.string(),
  issue: z.array(issueSchema),
});
export type OperationOutcome = z.infer<typeof operationOutcomeSchema>;

export const externalGatewayPatientSchema = z.object({
  id: z.string(),
  system: z.string(),
});
export type XCPDPatientId = z.infer<typeof externalGatewayPatientSchema>;

export const baseResponseSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  /** timestamp right after external gateway response */
  responseTimestamp: z.string(),
  /** timestamp right before external gateway request */
  requestTimestamp: z.string().optional(),
  /** duration of the request to the external gateway */
  duration: z.number().optional(),
  cxId: z.string().optional(),
  externalGatewayPatient: externalGatewayPatientSchema.optional(),
  patientId: z.string().nullish(),
  operationOutcome: operationOutcomeSchema.optional(),
});
export type BaseResponse = z.infer<typeof baseResponseSchema>;

export const baseErrorResponseSchema = baseResponseSchema.extend({
  operationOutcome: operationOutcomeSchema.optional(),
});
export type BaseErrorResponse = z.infer<typeof baseErrorResponseSchema>;

export function isBaseErrorResponse(obj: unknown): obj is BaseErrorResponse {
  const result = baseErrorResponseSchema.safeParse(obj);
  return result.success;
}

export const xcaGatewaySchema = z.object({
  homeCommunityId: z.string(),
  url: z.string(),
});
export type XCAGateway = z.infer<typeof xcaGatewaySchema>;

export const XCPDGatewaySchema = z.object({
  oid: z.string(),
  url: z.string(),
  id: z.string(),
});
export type XCPDGateway = z.infer<typeof XCPDGatewaySchema>;

export const documentReferenceSchema = z.object({
  homeCommunityId: z.string(),
  docUniqueId: z.string(), // TODO rename to externalGatewayDocId
  repositoryUniqueId: z.string(),
  fileName: z.string().nullish(),
  fileLocation: z.string().nullish(),
  size: z.number().nullish(),
  urn: z.string().nullish(),
  metriportId: z.string().nullish(),
  newRepositoryUniqueId: z.string().nullish(),
  newDocumentUniqueId: z.string().nullish(),
  contentType: z.string().nullish(),
  language: z.string().nullish(),
  url: z.string().nullish(),
  uri: z.string().nullish(),
  isNew: z.boolean().nullish(),
  creation: z.string().nullish(),
  title: z.string().nullish(),
  date: z.string().nullish(),
  authorInstitution: z.string().nullish(),
  contained: z
    .array(
      z.object({
        name: z.string().nullish(),
      })
    )
    .nullish(),
});
export type DocumentReference = z.infer<typeof documentReferenceSchema>;

export const nameSchema = z.object({
  family: z.string().optional(),
  given: z.array(z.string()).optional(),
});
export type Name = z.infer<typeof nameSchema>;

export const addressSchema = z.object({
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});
export type Address = z.infer<typeof addressSchema>;

export const telecomSchema = z.object({
  system: z.string().optional(),
  value: z.string().optional(),
});
export type Telecom = z.infer<typeof telecomSchema>;

export const personalIdentifierSchema = z.object({
  system: z.string().optional(),
  value: z.string().optional(),
});
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

export const genderSchema = z.enum(["male", "female", "other", "unknown", "undefined"]).optional();
export type Gender = z.infer<typeof genderSchema>;

export const patientResourceSchema = z.object({
  resourceType: z.string().optional(),
  id: z.string().optional(),
  name: z.array(nameSchema).optional(),
  gender: genderSchema,
  birthDate: z.string().optional(),
  address: z.array(addressSchema).optional(),
  telecom: z.array(telecomSchema).optional(),
  identifier: z.array(personalIdentifierSchema).optional(),
});

export type PatientResource = z.infer<typeof patientResourceSchema>;
