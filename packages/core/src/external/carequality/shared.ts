import { InboundDocumentQueryReq, InboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { FhirGender } from "../fhir/patient/conversion";
import { XDSMissingHomeCommunityId, XDSRegistryError } from "./error";
import { IheGender } from "./ihe-gateway-v2/schema";

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
