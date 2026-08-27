import { SubjectRole } from "@metriport/ihe-gateway-sdk";

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

export const defaultSubjectRole: SubjectRole = {
  code: "106331006",
  display: "Administrative AND/OR managerial worker",
  system: "2.16.840.1.113883.6.96",
};
