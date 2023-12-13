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
  patientId: z.string().nullish(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export const documentReferenceSchema = z.object({
  homeCommunityId: z.string(),
  docUniqueId: z.string(),
  urn: z.string(),
  repositoryUniqueId: z.string(),
  newRepositoryUniqueId: z.string().nullish(),
  newDocumentUniqueId: z.string().nullish(),
  contentType: z.string().nullish(),
  url: z.string().nullish(), // signed urls that mirth will use to download actually b64 bytes
  uri: z.string().nullish(),
  creation: z.string().nullish(),
  title: z.string().nullish(),
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

export const xcpdPatientIdSchema = z.object({
  id: z.string(),
  system: z.string(),
});

export type XCPDPatientId = z.infer<typeof xcpdPatientIdSchema>;

export const baseResponseSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  responseTimestamp: z.string(),
  xcpdPatientId: xcpdPatientIdSchema.nullish(),
  patientId: z.string().nullish(), // TODO should this not be nullish
  operationOutcome: operationOutcome.nullish(),
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
  system: z
    .union([
      z.literal("phone"),
      z.literal("fax"),
      z.literal("email"),
      z.literal("pager"),
      z.literal("url"),
      z.literal("sms"),
      z.literal("other"),
    ])
    .optional(),
  value: z.string().optional(),
});

const genderSchema = z
  .union([z.literal("male"), z.literal("female"), z.literal("other"), z.literal("unknown")])
  .optional();

const addressSchema = z.object({
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const patientResourceSchema = z.object({
  resourceType: z.literal("Patient"),
  id: z.string().optional(),
  identifier: z.array(identifierSchema).optional(),
  name: z.array(nameSchema),
  telecom: z.array(telecomSchema).optional(),
  gender: genderSchema,
  birthDate: z.string(),
  address: z.array(addressSchema).optional(),
});

export type PatientResource = z.infer<typeof patientResourceSchema>;

export const XCAGatewaySchema = z.object({
  homeCommunityId: z.string(),
  url: z.string(),
});
export type XCAGateway = z.infer<typeof XCAGatewaySchema>;
