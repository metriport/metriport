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

export type SamlAttributes = {
  subjectId: string;
  subjectRole: {
    display: string;
    code: string;
  };
  organization: string;
  organizationId: string;
  homeCommunityId: string;
  purposeOfUse: string;
};

export type BaseRequest = {
  id: string;
  timestamp: string;
  samlAttributes: SamlAttributes;
  patientId?: string;
};

export type Code = {
  system: string;
  code: string;
};

export type Details = { coding: Code[] } | { text: string };

export const issueSchema = z.object({
  severity: z.string(),
  code: z.string(),
  details: z.object({ text: z.string() }),
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
  xcpdPatientId: xcpdPatientIdSchema.optional(),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isBaseErrorResponse(obj: any): obj is BaseErrorResponse {
  const result = baseErrorResponseSchema.safeParse(obj);
  return result.success;
}

export type XCAGateway = {
  homeCommunityId: string;
  url: string;
};

export type DocumentReference = {
  homeCommunityId: string;
  docUniqueId: string;
  urn: string;
  repositoryUniqueId: string;
  newRepositoryUniqueId?: string;
  newDocumentUniqueId?: string;
  contentType?: string | null;
  language?: string | null;
  uri?: string | null;
  url?: string | null;
  creation?: string | null;
  title?: string | null;
};
