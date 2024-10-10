import { InboundDocumentQueryReq, InboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { USStateWithoutTerritories } from "@metriport/shared";
import { base64ToString, stringToBase64 } from "../../util/base64";
import { FhirGender } from "../fhir/patient/conversion";
import { XDSMissingHomeCommunityId, XDSRegistryError } from "./error";
import { IheGender } from "./ihe-gateway-v2/schema";

export const ORGANIZATION_NAME_DEFAULT = "Metriport";
export const METRIPORT_HOME_COMMUNITY_ID = "urn:oid:2.16.840.1.113883.3.9621";
export const METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX = "2.16.840.1.113883.3.9621";
export const METRIPORT_REPOSITORY_UNIQUE_ID = "urn:oid:2.16.840.1.113883.3.9621";
export const CODE_SYSTEM_ERROR = "1.3.6.1.4.1.19376.1.2.27.1";
export const DEFAULT_TITLE = "Clinical Document";
export const replyTo = "http://www.w3.org/2005/08/addressing/anonymous";

export const STATE_MAPPINGS: { [key: string]: USStateWithoutTerritories } = {
  "urn:oid:2.16.840.1.113883.4.3.2": USStateWithoutTerritories.AK, // Alaska Driver's License
  "urn:oid:2.16.840.1.113883.4.3.1": USStateWithoutTerritories.AL, // Alabama Driver's License
  "urn:oid:2.16.840.1.113883.4.3.5": USStateWithoutTerritories.AR, // Arkansas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.4": USStateWithoutTerritories.AZ, // Arizona Driver's License
  "urn:oid:2.16.840.1.113883.4.3.6": USStateWithoutTerritories.CA, // California Driver's License
  "urn:oid:2.16.840.1.113883.4.3.8": USStateWithoutTerritories.CO, // Colorado Driver's License
  "urn:oid:2.16.840.1.113883.4.3.9": USStateWithoutTerritories.CT, // Connecticut Driver's License
  "urn:oid:2.16.840.1.113883.4.3.11": USStateWithoutTerritories.DC, // DC Driver's License
  "urn:oid:2.16.840.1.113883.4.3.10": USStateWithoutTerritories.DE, // Delaware Driver's License
  "urn:oid:2.16.840.1.113883.4.3.12": USStateWithoutTerritories.FL, // Florida Driver's License
  "urn:oid:2.16.840.1.113883.4.3.13": USStateWithoutTerritories.GA, // Georgia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.15": USStateWithoutTerritories.HI, // Hawaii Driver's License
  "urn:oid:2.16.840.1.113883.4.3.18": USStateWithoutTerritories.IN, // Indiana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.19": USStateWithoutTerritories.IA, // Iowa Driver's License
  "urn:oid:2.16.840.1.113883.4.3.16": USStateWithoutTerritories.ID, // Idaho Driver's License
  "urn:oid:2.16.840.1.113883.4.3.17": USStateWithoutTerritories.IL, // Illinois Driver's License
  "urn:oid:2.16.840.1.113883.4.3.20": USStateWithoutTerritories.KS, // Kansas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.21": USStateWithoutTerritories.KY, // Kentucky Driver's License
  "urn:oid:2.16.840.1.113883.4.3.22": USStateWithoutTerritories.LA, // Louisiana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.25": USStateWithoutTerritories.MA, // Massachusetts Driver's License
  "urn:oid:2.16.840.1.113883.4.3.24": USStateWithoutTerritories.MD, // Maryland Driver's License
  "urn:oid:2.16.840.1.113883.4.3.23": USStateWithoutTerritories.ME, // Maine Driver's License
  "urn:oid:2.16.840.1.113883.4.3.26": USStateWithoutTerritories.MI, // Michigan Driver's License
  "urn:oid:2.16.840.1.113883.4.3.27": USStateWithoutTerritories.MN, // Minnesota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.29": USStateWithoutTerritories.MO, // Missouri Driver's License
  "urn:oid:2.16.840.1.113883.4.3.28": USStateWithoutTerritories.MS, // Mississippi Driver's License
  "urn:oid:2.16.840.1.113883.4.3.30": USStateWithoutTerritories.MT, // Montana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.36": USStateWithoutTerritories.NY, // New York Driver's License
  "urn:oid:2.16.840.1.113883.4.3.37": USStateWithoutTerritories.NC, // North Carolina Driver's License
  "urn:oid:2.16.840.1.113883.4.3.38": USStateWithoutTerritories.ND, // North Dakota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.31": USStateWithoutTerritories.NE, // Nebraska Driver's License
  "urn:oid:2.16.840.1.113883.4.3.33": USStateWithoutTerritories.NH, // New Hampshire Driver's License
  "urn:oid:2.16.840.1.113883.4.3.34": USStateWithoutTerritories.NJ, // New Jersey Driver's License
  "urn:oid:2.16.840.1.113883.4.3.35": USStateWithoutTerritories.NM, // New Mexico Driver's License
  "urn:oid:2.16.840.1.113883.4.3.32": USStateWithoutTerritories.NV, // Nevada Driver's License
  "urn:oid:2.16.840.1.113883.4.3.39": USStateWithoutTerritories.OH, // Ohio Driver's License
  "urn:oid:2.16.840.1.113883.4.3.40": USStateWithoutTerritories.OK, // Oklahoma Driver's License
  "urn:oid:2.16.840.1.113883.4.3.41": USStateWithoutTerritories.OR, // Oregon Driver's License
  "urn:oid:2.16.840.1.113883.4.3.42": USStateWithoutTerritories.PA, // Pennsylvania Driver's License
  "urn:oid:2.16.840.1.113883.4.3.44": USStateWithoutTerritories.RI, // Rhode Island Driver's License
  "urn:oid:2.16.840.1.113883.4.3.45": USStateWithoutTerritories.SC, // South Carolina Driver's License
  "urn:oid:2.16.840.1.113883.4.3.46": USStateWithoutTerritories.SD, // South Dakota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.47": USStateWithoutTerritories.TN, // Tennessee Driver's License
  "urn:oid:2.16.840.1.113883.4.3.48": USStateWithoutTerritories.TX, // Texas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.49": USStateWithoutTerritories.UT, // Utah Driver's License
  "urn:oid:2.16.840.1.113883.4.3.51": USStateWithoutTerritories.VA, // Virginia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.50": USStateWithoutTerritories.VT, // Vermont Driver's License
  "urn:oid:2.16.840.1.113883.4.3.53": USStateWithoutTerritories.WA, // Washington Driver's License
  "urn:oid:2.16.840.1.113883.4.3.55": USStateWithoutTerritories.WI, // Wisconsin Driver's License
  "urn:oid:2.16.840.1.113883.4.3.54": USStateWithoutTerritories.WV, // West Virginia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.56": USStateWithoutTerritories.WY, // Wyoming Driver's License
};

export function createPatientUniqueId(cxId: string, patientId: string): string {
  return stringToBase64(`${cxId}/${patientId}`);
}

export function extractPatientUniqueId(patientId: string): string {
  return base64ToString(patientId);
}

export function createDocumentUniqueId(documentId: string): string {
  return stringToBase64(documentId);
}
export function extractDocumentUniqueId(documentId: string): string {
  return base64ToString(documentId);
}

export function validateBasePayload(
  payload: InboundDocumentQueryReq | InboundDocumentRetrievalReq
): void {
  if (!payload.id) {
    throw new XDSRegistryError("Request id is not defined");
  }

  if (!payload.timestamp) {
    throw new XDSRegistryError("Timestamp is not defined");
  }

  if (!payload.samlAttributes.homeCommunityId) {
    throw new XDSMissingHomeCommunityId("Home Community ID is not defined");
  }
}

const fhirGenderToIheGender: Record<FhirGender, IheGender> = {
  female: "F",
  male: "M",
  other: "UN",
  unknown: "UNK",
};

const iheGenderToFhirGender: Record<IheGender, FhirGender> = {
  F: "female",
  M: "male",
  UN: "other",
  OTH: "other",
  FTM: "other",
  MTF: "other",
  UNK: "unknown",
  U: "unknown",
};

export function mapIheGenderToFhir(k: IheGender | undefined): FhirGender {
  if (k === undefined) {
    return "unknown";
  }
  const gender = iheGenderToFhirGender[k];
  return gender ? gender : "unknown";
}

export function mapFhirToIheGender(gender: FhirGender | undefined): IheGender {
  return gender ? fhirGenderToIheGender[gender] : "UNK";
}
