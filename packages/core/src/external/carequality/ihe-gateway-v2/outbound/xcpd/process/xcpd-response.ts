import { XMLParser } from "fast-xml-parser";
import {
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryReq,
  XCPDGateway,
  OperationOutcome,
  Name,
  Address,
  Telecom,
  PersonalIdentifier,
} from "@metriport/ihe-gateway-sdk";
import { normalizeGender } from "../../../utils";
import { XCPDSamlClientResponse } from "../send/xcpd-requests";
import { out } from "../../../../../../util/log";
import { toArray, extractText } from "../../../utils";
import { IheAddress, IheIdentifier, IheName, IheTelecom } from "../../../schema";
import { Iti55Response, iti55ResponseSchema, PatientRegistryProfile } from "./schema";
import {
  handleHTTPErrorResponse,
  handleSchemaErrorResponse,
  handlePatientErrorResponse,
} from "./error";

const { log } = out("Processing XCPD Requests");

function convertIheIdentifierToPersonalIdentifier(
  identifier: IheIdentifier
): PersonalIdentifier | undefined {
  if (!identifier?._extension && !identifier?._root) {
    return undefined;
  }
  return {
    value: identifier?._extension,
    system: identifier?._root,
  };
}

function iheIdentifiersToPersonalIdentifiers(
  otherIds: IheIdentifier[]
): PersonalIdentifier[] | undefined {
  if (!otherIds) {
    return undefined;
  }
  const personalIdentifiers = otherIds
    .map(convertIheIdentifierToPersonalIdentifier)
    .filter((id): id is PersonalIdentifier => id !== undefined);

  return personalIdentifiers.length > 0 ? personalIdentifiers : undefined;
}
function convertIheAddressToAddress(address: IheAddress): Address | undefined {
  if (!address?.city && !address?.state && !address?.postalCode) {
    return undefined;
  }
  const line = toArray(address?.streetAddressLine).map(String);
  return {
    ...(line.length > 0 && { line }),
    city: address?.city ? String(address?.city) : undefined,
    state: address?.state ? String(address?.state) : undefined,
    postalCode: address?.postalCode ? String(address?.postalCode) : undefined,
    country: address?.country ? String(address?.country) : undefined,
  };
}

function iheAddressesToAddresses(iheAddresses: IheAddress[] | undefined): Address[] | undefined {
  if (!iheAddresses) {
    return undefined;
  }
  const addresses = iheAddresses
    .map(convertIheAddressToAddress)
    .filter((address): address is Address => address !== undefined);

  return addresses.length > 0 ? addresses : undefined;
}

function convertIheNameToCarequalityName(name: IheName): Name {
  return {
    given: toArray(name.given).map(extractText),
    family: extractText(name.family),
  };
}

function iheNamesToNames(iheNames: IheName[]): Name[] {
  return iheNames.map(convertIheNameToCarequalityName);
}

function convertIheTelecomToTelecom(iheTelecom: IheTelecom): Telecom | undefined {
  if (!iheTelecom?._use && !iheTelecom?._value) {
    return undefined;
  }
  return {
    system: iheTelecom?._use,
    value: iheTelecom?._value,
  };
}

function iheTelecomsToTelecoms(iheTelecom: IheTelecom[]): Telecom[] | undefined {
  if (!iheTelecom) {
    return undefined;
  }
  const telecoms = iheTelecom
    .map(convertIheTelecomToTelecom)
    .filter((telecom): telecom is Telecom => telecom !== undefined);

  return telecoms.length > 0 ? telecoms : undefined;
}

function handlePatientMatchResponse({
  patientRegistryProfile,
  outboundRequest,
  gateway,
}: {
  patientRegistryProfile: PatientRegistryProfile;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}): OutboundPatientDiscoveryResp {
  const subject1 = patientRegistryProfile.controlActProcess?.subject?.registrationEvent?.subject1;
  const addr = toArray(subject1?.patient?.patientPerson?.addr);
  const names = toArray(subject1?.patient?.patientPerson?.name);
  const telecoms = toArray(subject1?.patient?.patientPerson?.telecom);
  const otherIds = toArray(subject1?.patient?.patientPerson?.asOtherIDs?.id);

  const addresses = iheAddressesToAddresses(addr);
  const patientNames = iheNamesToNames(names);
  const patientTelecoms = iheTelecomsToTelecoms(telecoms);
  const patientIdentifiers = iheIdentifiersToPersonalIdentifiers(otherIds);

  const patientResource = {
    name: patientNames,
    gender: normalizeGender(subject1?.patient?.patientPerson?.administrativeGenderCode?._code),
    birthDate: subject1?.patient?.patientPerson?.birthTime?._value,
    ...(addresses && { address: addresses }),
    ...(patientTelecoms && { telecom: patientTelecoms }),
    ...(patientIdentifiers && { identifier: patientIdentifiers }),
  };

  const response: OutboundPatientDiscoveryResp = {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    externalGatewayPatient: {
      id: subject1.patient.id._extension,
      system: subject1.patient.id._root,
    },
    gateway: gateway,
    patientId: outboundRequest.patientId,
    patientMatch: true,
    gatewayHomeCommunityId: outboundRequest.samlAttributes.homeCommunityId,
    patientResource: patientResource,
  };

  return response;
}

function handlePatientNoMatchResponse({
  outboundRequest,
  gateway,
}: {
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}): OutboundPatientDiscoveryResp {
  const issue = {
    severity: "information",
    code: "not-found",
    details: {
      text: "NF",
    },
  };
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [issue],
  };
  const response: OutboundPatientDiscoveryResp = {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway: gateway,
    patientId: outboundRequest.patientId,
    patientMatch: false,
    operationOutcome: operationOutcome,
  };
  return response;
}

export function processXCPDResponse({
  xcpdResponse: { response, success, outboundRequest, gateway },
  patientId,
  cxId,
}: {
  xcpdResponse: XCPDSamlClientResponse;
  patientId?: string;
  cxId?: string;
}): OutboundPatientDiscoveryResp {
  if (success === false) {
    return handleHTTPErrorResponse({
      httpError: response,
      outboundRequest,
      gateway,
    });
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });

  const jsonObj = parser.parse(response);
  try {
    const iti55Response = iti55ResponseSchema.parse(jsonObj);
    const patientRegistryProfile = getPatientRegistryProfile(iti55Response);
    const { ack, queryResponseCode } =
      getAckAndQueryResponseCodeFromPatientRegistryProfile(patientRegistryProfile);

    if (isApplicationAccept(ack) && isXCPDRespOk(queryResponseCode)) {
      log(`Found a match for cxId: ${cxId} patient: ${patientId}`);
      return handlePatientMatchResponse({
        patientRegistryProfile,
        outboundRequest,
        gateway,
      });
    } else if (isApplicationAccept(ack) && isXCPDRespNotFound(queryResponseCode)) {
      return handlePatientNoMatchResponse({
        outboundRequest,
        gateway,
      });
    } else {
      return handlePatientErrorResponse({
        patientRegistryProfile,
        outboundRequest,
        gateway,
      });
    }
  } catch (error) {
    log(`Error processing XCPD response: ${error}`);
    return handleSchemaErrorResponse({
      outboundRequest,
      gateway,
    });
  }
}

function isApplicationAccept(ack: string): boolean {
  return ack === "AA";
}

function isXCPDRespOk(queryResponseCode: string): boolean {
  return queryResponseCode === "OK";
}

function isXCPDRespNotFound(queryResponseCode: string): boolean {
  return queryResponseCode === "NF";
}

function getPatientRegistryProfile(iti55Response: Iti55Response): PatientRegistryProfile {
  return iti55Response.Envelope.Body.PRPA_IN201306UV02;
}

function getAckAndQueryResponseCodeFromPatientRegistryProfile(
  patientRegistryProfile: PatientRegistryProfile
): {
  ack: string;
  queryResponseCode: string;
} {
  return {
    ack: patientRegistryProfile.acknowledgement.typeCode._code,
    queryResponseCode: patientRegistryProfile.controlActProcess.queryAck.queryResponseCode._code,
  };
}
