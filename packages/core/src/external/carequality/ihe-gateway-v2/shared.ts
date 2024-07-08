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
