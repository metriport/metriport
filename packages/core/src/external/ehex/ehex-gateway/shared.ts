import { SubjectRole } from "@metriport/ihe-gateway-sdk";
import { z } from "zod";
import { Config } from "../../../util/config";

export const REDACTED = "[REDACTED]";

export enum queryResponseCodes {
  OK = "OK",
  NF = "NF",
  AE = "AE",
}

export enum ackCodes {
  AA = "AA",
  AE = "AE",
}

export const attributeNamePrefix = "@_";
export const xmlBuilderAttributes = {
  format: false,
  ignoreAttributes: false,
  attributeNamePrefix: attributeNamePrefix,
  suppressEmptyNode: true,
  declaration: {
    include: true,
    encoding: "UTF-8",
    version: "1.0",
  },
};

// TODO ENG-1601 Duplicate of cqOrgUrlsSchema on packages/api, keep this one here.
export const ehexServiceOwnUrlsSchema = z.object({
  urlXcpd: z.string().optional(),
  urlDq: z.string().optional(),
  urlDr: z.string().optional(),
});
// TODO ENG-1601 Duplicate of cqOrgUrlsSchema on packages/api, keep this one here.
export type EhexOrgUrls = z.infer<typeof ehexServiceOwnUrlsSchema>;

// TODO ENG-1601 Duplicate of cqOrgUrlsSchema on packages/api, keep this one here.
export function getEhexServiceOwnUrls(): EhexOrgUrls {
  const ehexOrgUrlsString = Config.getEhexServiceOwnUrls();
  const urls = ehexOrgUrlsString
    ? ehexServiceOwnUrlsSchema.parse(JSON.parse(ehexOrgUrlsString))
    : {};
  return urls;
}

export const defaultSubjectRole: SubjectRole = {
  code: "106331006",
  display: "Administrative AND/OR managerial worker",
  system: "2.16.840.1.113883.6.96",
};
