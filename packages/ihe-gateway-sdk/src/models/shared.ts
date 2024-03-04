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
  patientId: z.string().optional(),
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
  responseTimestamp: z.string(),
  cxId: z.string().optional(),
  externalGatewayPatient: externalGatewayPatientSchema.optional(),
  patientId: z.string().optional(),
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
  url: z.string().optional(),
  id: z.string().optional(),
});
export type XCPDGateway = z.infer<typeof XCPDGatewaySchema>;

export type XCPDGateways = XCPDGateway[];

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
});
export type DocumentReference = z.infer<typeof documentReferenceSchema>;
