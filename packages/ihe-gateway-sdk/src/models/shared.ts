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

export const samlAttributes = z.object({
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

export type SamlAttributes = z.infer<typeof samlAttributes>;

export const documentReference = z.object({
  homeCommunityId: z.string(),
  urn: z.string(),
  repositoryUniqueId: z.string(),
  contentType: z.string().nullable(),
  uri: z.string().nullable(),
  creation: z.string().nullable(),
  title: z.string().nullable(),
});

export type DocumentReference = z.infer<typeof documentReference>;

export const issue = z.object({
  severity: z.string(),
  code: z.string(),
  details: z.object({ text: z.string() }),
});

export const operationOutcome = z.object({
  resourceType: z.string(),
  id: z.string(),
  issue: z.array(issue),
});

export type OperationOutcome = z.infer<typeof operationOutcome>;

export const baseRequestSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  timestamp: z.string(),
  samlAttributes,
});

export const baseResponseSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  timestamp: z.string(),
  responseTimestamp: z.string(),
  xcpdPatientId: z.object({ id: z.string(), system: z.string() }).nullable(),
  patientId: z.string(),
  operationOutcome: operationOutcome.nullable(),
});
