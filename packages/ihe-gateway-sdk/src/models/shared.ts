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

export const baseRequestSchema = z.object({
  id: z.string(),
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

export const xcpdPatientIdSchema = z.object({
  id: z.string(),
  system: z.string(),
});
export type XCPDPatientId = z.infer<typeof xcpdPatientIdSchema>;

export const baseResponseSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  responseTimestamp: z.string(),
  externalGatewayPatient: xcpdPatientIdSchema.optional(),
  patientId: z.string().optional(),
});
export type BaseResponse = z.infer<typeof baseResponseSchema>;

export const baseErrorResponseSchema = z.intersection(
  baseResponseSchema,
  z.object({
    operationOutcome: operationOutcomeSchema,
  })
);
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

export const documentReferenceSchema = z.object({
  homeCommunityId: z.string(),
  docUniqueId: z.string(),
  urn: z.string(),
  repositoryUniqueId: z.string(),
  newRepositoryUniqueId: z.string().nullish(),
  newDocumentUniqueId: z.string().nullish(),
  contentType: z.string().nullish(),
  language: z.string().nullish(),
  uri: z.string().nullish(),
  url: z.string().nullish(),
  creation: z.string().nullish(),
  title: z.string().nullish(),
});
export type DocumentReference = z.infer<typeof documentReferenceSchema>;
