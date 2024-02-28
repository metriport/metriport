import { PurposeOfUse } from "@metriport/shared";
import z from "zod";

// TODO: adjust when we support multiple POUs
export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
}

export function isGWValid(gateway: { homeCommunityId: string; url: string }): boolean {
  return !!gateway.homeCommunityId && !!gateway.url;
}

export const cqOrgUrlsSchema = z.object({
  urlXCPD: z.string().optional(),
  urlDQ: z.string().optional(),
  urlDR: z.string().optional(),
});

export type CQOrgUrls = z.infer<typeof cqOrgUrlsSchema>;

export const cqOrgDetailsSchema = z.object({
  name: z.string(),
  oid: z.string(),
  addressLine1: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  lat: z.string(),
  lon: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string(),
  role: z.enum(["Implementer", "Connection"]),
  hostOrgOID: z.string().optional(),
});

export type CQOrgDetails = z.infer<typeof cqOrgDetailsSchema>;
export type CQOrgDetailsWithUrls = CQOrgDetails & CQOrgUrls;
