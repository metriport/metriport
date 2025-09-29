import { InboundDocumentQueryReq, InboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { USState } from "@metriport/shared";
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
export const PRINCIPAL_AND_DELEGATES_FILE_NAME = "principal-and-delegates.json";

// Our code accepts Driver's License from territories as well, see
// packages/core/src/domain/oid.ts:driversLicenseURIs()
// TODO we should make those consistent next time we touch this
export const STATE_MAPPINGS: { [key: string]: USState } = {
  "urn:oid:2.16.840.1.113883.4.3.2": USState.AK, // Alaska Driver's License
  "urn:oid:2.16.840.1.113883.4.3.1": USState.AL, // Alabama Driver's License
  "urn:oid:2.16.840.1.113883.4.3.5": USState.AR, // Arkansas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.4": USState.AZ, // Arizona Driver's License
  "urn:oid:2.16.840.1.113883.4.3.6": USState.CA, // California Driver's License
  "urn:oid:2.16.840.1.113883.4.3.8": USState.CO, // Colorado Driver's License
  "urn:oid:2.16.840.1.113883.4.3.9": USState.CT, // Connecticut Driver's License
  "urn:oid:2.16.840.1.113883.4.3.11": USState.DC, // DC Driver's License
  "urn:oid:2.16.840.1.113883.4.3.10": USState.DE, // Delaware Driver's License
  "urn:oid:2.16.840.1.113883.4.3.12": USState.FL, // Florida Driver's License
  "urn:oid:2.16.840.1.113883.4.3.13": USState.GA, // Georgia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.15": USState.HI, // Hawaii Driver's License
  "urn:oid:2.16.840.1.113883.4.3.18": USState.IN, // Indiana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.19": USState.IA, // Iowa Driver's License
  "urn:oid:2.16.840.1.113883.4.3.16": USState.ID, // Idaho Driver's License
  "urn:oid:2.16.840.1.113883.4.3.17": USState.IL, // Illinois Driver's License
  "urn:oid:2.16.840.1.113883.4.3.20": USState.KS, // Kansas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.21": USState.KY, // Kentucky Driver's License
  "urn:oid:2.16.840.1.113883.4.3.22": USState.LA, // Louisiana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.25": USState.MA, // Massachusetts Driver's License
  "urn:oid:2.16.840.1.113883.4.3.24": USState.MD, // Maryland Driver's License
  "urn:oid:2.16.840.1.113883.4.3.23": USState.ME, // Maine Driver's License
  "urn:oid:2.16.840.1.113883.4.3.26": USState.MI, // Michigan Driver's License
  "urn:oid:2.16.840.1.113883.4.3.27": USState.MN, // Minnesota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.29": USState.MO, // Missouri Driver's License
  "urn:oid:2.16.840.1.113883.4.3.28": USState.MS, // Mississippi Driver's License
  "urn:oid:2.16.840.1.113883.4.3.30": USState.MT, // Montana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.36": USState.NY, // New York Driver's License
  "urn:oid:2.16.840.1.113883.4.3.37": USState.NC, // North Carolina Driver's License
  "urn:oid:2.16.840.1.113883.4.3.38": USState.ND, // North Dakota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.31": USState.NE, // Nebraska Driver's License
  "urn:oid:2.16.840.1.113883.4.3.33": USState.NH, // New Hampshire Driver's License
  "urn:oid:2.16.840.1.113883.4.3.34": USState.NJ, // New Jersey Driver's License
  "urn:oid:2.16.840.1.113883.4.3.35": USState.NM, // New Mexico Driver's License
  "urn:oid:2.16.840.1.113883.4.3.32": USState.NV, // Nevada Driver's License
  "urn:oid:2.16.840.1.113883.4.3.39": USState.OH, // Ohio Driver's License
  "urn:oid:2.16.840.1.113883.4.3.40": USState.OK, // Oklahoma Driver's License
  "urn:oid:2.16.840.1.113883.4.3.41": USState.OR, // Oregon Driver's License
  "urn:oid:2.16.840.1.113883.4.3.42": USState.PA, // Pennsylvania Driver's License
  "urn:oid:2.16.840.1.113883.4.3.44": USState.RI, // Rhode Island Driver's License
  "urn:oid:2.16.840.1.113883.4.3.45": USState.SC, // South Carolina Driver's License
  "urn:oid:2.16.840.1.113883.4.3.46": USState.SD, // South Dakota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.47": USState.TN, // Tennessee Driver's License
  "urn:oid:2.16.840.1.113883.4.3.48": USState.TX, // Texas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.49": USState.UT, // Utah Driver's License
  "urn:oid:2.16.840.1.113883.4.3.51": USState.VA, // Virginia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.50": USState.VT, // Vermont Driver's License
  "urn:oid:2.16.840.1.113883.4.3.53": USState.WA, // Washington Driver's License
  "urn:oid:2.16.840.1.113883.4.3.55": USState.WI, // Wisconsin Driver's License
  "urn:oid:2.16.840.1.113883.4.3.54": USState.WV, // West Virginia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.56": USState.WY, // Wyoming Driver's License
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
