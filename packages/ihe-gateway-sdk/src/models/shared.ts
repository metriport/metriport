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
  cxId: string;
  timestamp: string;
  samlAttributes: SamlAttributes;
};

export const documentReference = z.object({
  homeCommunityId: z.string(),
  docUniqueId: z.string(),
  repositoryUniqueId: z.string(),
  contentType: z.string().nullish(),
  language: z.string().nullish(),
  uri: z.string().nullish(),
  creation: z.string().nullish(),
  title: z.string().nullish(),
});

export type DocumentReference = z.infer<typeof documentReference>;
