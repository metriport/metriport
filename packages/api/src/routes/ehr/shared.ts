export type RouteDetails = {
  regex: RegExp;
  paramMatchIndex?: number;
  queryParam?: string;
}[];

const idRegex = "([a-zA-Z0-9\\_\\-\\.])+";

export const patientBasePath = "/medical/v1/patient";
export const documentBasePath = "/medical/v1/document";

export const validPatientRoutes: RouteDetails = [
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})$`),
    paramMatchIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/consolidated/count)$`),
    paramMatchIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/consolidated/query)$`),
    paramMatchIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/consolidated/webhook)$`),
    paramMatchIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/medical-record)$`),
    paramMatchIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/medical-record-status)$`),
    paramMatchIndex: 2,
  },
];

export const validedDocumentRoutes: RouteDetails = [
  {
    regex: new RegExp(`^(${documentBasePath})$`),
    queryParam: "patientId",
  },
  {
    regex: new RegExp(`^(${documentBasePath}/query)$`),
    queryParam: "patientId",
  },
];
