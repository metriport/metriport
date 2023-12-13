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

export const samlAttributesSchema = z.object({
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

export type SamlAttributes = z.infer<typeof samlAttributesSchema>;

export const baseRequestSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  samlAttributes: samlAttributesSchema,
  patientId: z.string().nullable(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export const documentReferenceSchema = z.object({
  homeCommunityId: z.string(),
  docUniqueId: z.string(),
  urn: z.string(),
  repositoryUniqueId: z.string(),
  newRepositoryUniqueId: z.string().nullable(),
  newDocumentUniqueId: z.string().nullable(),
  contentType: z.string().nullable(),
  url: z.string().nullable(), // signed urls that mirth will use to download actually b64 bytes
  uri: z.string().nullable(),
  creation: z.string().nullable(),
  title: z.string().nullable(),
});

export type DocumentReference = z.infer<typeof documentReferenceSchema>;

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

export const baseResponseSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  responseTimestamp: z.string(),
  xcpdPatientId: z.object({ id: z.string(), system: z.string() }).nullable(), // why nullable as oppposed to optional?
  patientId: z.string().nullable(), // TODO should this not be nullable
  operationOutcome: operationOutcome.nullable(),
});

export type BaseResponse = z.infer<typeof baseResponseSchema>;

const identifierSchema = z.object({
  system: z.string().optional(),
  value: z.string().optional(),
});

const nameSchema = z.object({
  family: z.string(),
  given: z.array(z.string()),
});

const telecomSchema = z.object({
  system: z.string().optional(),
  value: z.string().optional(),
});

const addressSchema = z.object({
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const patientResourceSchema = z.object({
  resourceType: z.literal("Patient").optional(),
  id: z.string().optional(),
  identifier: z.array(identifierSchema).optional(),
  name: z.array(nameSchema),
  telecom: z.array(telecomSchema).optional(),
  gender: z.string(),
  birthDate: z.string(),
  address: z.array(addressSchema).optional(),
});

export type PatientResource = z.infer<typeof patientResourceSchema>;

export type XCAGateway = {
  homeCommunityId: string;
  url: string;
};
