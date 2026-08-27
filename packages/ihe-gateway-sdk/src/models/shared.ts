import { normalizeOid, validateNPI } from "@metriport/shared";
import { z } from "zod";

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

const subjectRoleSchema = z.object({
  display: z.string(),
  code: z.string(),
  system: z.string(),
});
export type SubjectRole = z.infer<typeof subjectRoleSchema>;

export const SamlAttributesSchema = z.object({
  // TODO ENG-1601 Move this to the inbound and outbound schemas, it's not part of SAML, but SOAP
  // TODO ENG-1601 Also, consider trying to parse "To" (wsaTo) and before falling back to the default server's config
  /** WS-Addressing From address, "who (server/app) sent/initiated this request?" */
  wsaFrom: z.string().nullish(),
  replyTo: z.string().nullish(),
  userId: z.string().nullish(),
  subjectId: z.string(),
  queryGrantorOid: z.string().optional(),
  subjectRole: subjectRoleSchema,
  organization: z.string(),
  organizationId: z.string(),
  homeCommunityId: z.string(),
  purposeOfUse: z.string(),
  principalOid: z.string().optional(),
});
export type SamlAttributes = z.infer<typeof SamlAttributesSchema>;

export const outboundSamlAttributesSchema = SamlAttributesSchema;
export type OutboundSamlAttributes = z.infer<typeof outboundSamlAttributesSchema>;

export const baseRequestSchema = z.object({
  id: z.string(),
  requestChunkId: z.string().optional(),
  cxId: z.string().optional(),
  timestamp: z.string(),
  samlAttributes: SamlAttributesSchema,
  patientId: z.string().nullish(),
  signatureConfirmation: z.string().optional(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export const codeSchema = z.object({
  system: z.string(),
  code: z.string(),
});

export type Code = z.infer<typeof codeSchema>;

export const detailsSchema = z.object({
  coding: z.array(codeSchema).optional(),
  text: z.string().optional(),
});

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
  requestChunkId: z.string().nullish(),
  timestamp: z.string(),
  /** timestamp right after external gateway response */
  responseTimestamp: z.string(),
  /** timestamp right before external gateway request */
  requestTimestamp: z.string().optional(),
  /** duration of the request to the external gateway */
  duration: z.number().optional(),
  cxId: z.string().optional(),
  externalGatewayPatient: externalGatewayPatientSchema.optional(),
  patientId: z.string().nullish(), // Usually b64 encoded with the cxId
  decodedPatientId: z.string().nullish(), // Decoded patient ID, what we have on our end
  operationOutcome: operationOutcomeSchema.optional(),
  responseHttpStatusCode: z.number().optional(),
  signatureConfirmation: z.string().optional(),
  retried: z.number().optional(),
  iheGatewayV2: z.boolean().optional(),
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

/**
 * TODO ENG-1601 FIX THIS
 * - homeCommunityId is currently the OID of the gateway
 * - actualHomeCommunityId is the homeCommunityId of the gateway
 * See create-outbound-document-query-req.ts, buildRequest()
 */
export const xcaGatewaySchema = z.object({
  actualHomeCommunityId: z.string().nullish(),
  homeCommunityId: z.string(),
  url: z.string(),
});
export type XCAGateway = z.infer<typeof xcaGatewaySchema>;

export const XCPDGatewaySchema = z.object({
  oid: z.string(),
  url: z.string(),
  /** Being populated with the homeCommunityId of the gateway */
  id: z.string(),
});
export type XCPDGateway = z.infer<typeof XCPDGatewaySchema>;

const nullishStringToUndefinedSchema = z
  .string()
  .nullish()
  .transform(v => v ?? undefined);
export const codingSchema = z.object({
  system: nullishStringToUndefinedSchema.optional(),
  code: nullishStringToUndefinedSchema.optional(),
  display: nullishStringToUndefinedSchema.optional(),
});
export type Coding = z.infer<typeof codingSchema>;

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
  serviceStartTime: z.string().optional(),
  serviceStopTime: z.string().optional(),
  creation: z.string().nullish(),
  title: z.string().nullish(),
  date: z.string().nullish(),
  authorPerson: z.string().nullish(),
  authorInstitution: z.string().nullish(),
  classCoding: codingSchema.optional(),
  typeCoding: codingSchema.optional(),
  formatCoding: codingSchema.optional(),
  confidentialityCoding: codingSchema.optional(),
  practiceSettingCoding: codingSchema.optional(),
  healthcareFacilityTypeCoding: codingSchema.optional(),
  contained: z
    .array(
      z.object({
        name: z.string().nullish(),
      })
    )
    .nullish(),
});
export type DocumentReference = z.infer<typeof documentReferenceSchema>;
