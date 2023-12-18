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

export type Issue = {
  severity: string;
  code: string;
  details: Details;
};

export type OperationOutcome = {
  resourceType: string;
  id: string;
  issue: Issue[];
};

export type XCPDPatientId = {
  id: string;
  system: string;
};

export type BaseResponse = {
  id: string;
  timestamp: string;
  responseTimestamp: string;
  xcpdPatientId?: XCPDPatientId;
  patientId?: string; // TODO should this not be nullish
  operationOutcome?: OperationOutcome;
};

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
  contentType?: string;
  url?: string; // signed urls that mirth will use to download actually b64 bytes
  uri?: string;
  creation?: string;
  title?: string;
};
