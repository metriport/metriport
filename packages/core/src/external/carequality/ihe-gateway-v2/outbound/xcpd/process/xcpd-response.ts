import { XMLParser } from "fast-xml-parser";
import {
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryRespFaultSchema,
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
import { toArray } from "../../../utils";

const { log } = out("Processing XCPD Requests");

type IheAddress = {
  streetAddressLine?: string | string[] | number | number[] | undefined;
  city?: string | number | undefined;
  state?: string | number | undefined;
  postalCode?: string | number | undefined;
  country?: string | number | undefined;
  county?: string | number | undefined;
};

type IheName = {
  given: string | string[];
  family: string;
  delimiter: string | undefined;
};

type IheTelecom = {
  _use: string | undefined;
  _value: string | undefined;
};

type IheIdentifier = {
  _extension: string | undefined;
  _root: string | undefined;
};

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

export function convertIheAddressToAddress(address: IheAddress): Address | undefined {
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

export function isValidAddress(address: Address): boolean {
  const isStringOrStringArray = (value: unknown): value is string | string[] =>
    typeof value === "string" ||
    (Array.isArray(value) && value.length > 0 && value.every(item => typeof item === "string"));

  return (
    (isStringOrStringArray(address?.line) || address?.line === undefined) &&
    (typeof address?.city === "string" || address?.city === undefined) &&
    (typeof address?.state === "string" || address?.state === undefined) &&
    (typeof address?.postalCode === "string" || address?.postalCode === undefined) &&
    (typeof address?.country === "string" || address?.country === undefined)
  );
}

export function iheAddressesToAddresses(iheAddresses: IheAddress[]): Address[] | undefined {
  if (!iheAddresses) {
    return undefined;
  }
  const addresses = iheAddresses
    .map(convertIheAddressToAddress)
    .filter((address): address is Address => address !== undefined && isValidAddress(address));

  return addresses.length > 0 ? addresses : undefined;
}

function convertIheNameToCarequalityName(name: IheName): Name {
  return {
    given: toArray(name?.given),
    family: name.family,
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

function handleHTTPErrorResponse({
  httpError,
  outboundRequest,
  gateway,
}: {
  httpError: string;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}): OutboundPatientDiscoveryRespFaultSchema {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      {
        severity: "error",
        code: "http-error",
        details: {
          text: httpError,
        },
      },
    ],
  };
  return {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway: gateway,
    patientId: outboundRequest?.patientId,
    patientMatch: null,
    operationOutcome: operationOutcome,
  };
}

function handlePatientMatchResponse({
  jsonObj,
  outboundRequest,
  gateway,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonObj: any;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}): OutboundPatientDiscoveryResp {
  const subject1 =
    getPatientRegistryProfile(jsonObj)?.controlActProcess?.subject?.registrationEvent?.subject1;
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
      id: subject1?.patient?.id?._extension,
      system: subject1?.patient?.id?._root,
    },
    gateway: gateway,
    patientId: outboundRequest.patientId,
    patientMatch: true,
    gatewayHomeCommunityId: outboundRequest.samlAttributes.homeCommunityId,
    patientResource: patientResource,
  };

  return response;
}

function handlePatientErrorResponse({
  jsonObj,
  outboundRequest,
  gateway,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonObj: any;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
  patientId?: string | undefined;
  cxId?: string | undefined;
}): OutboundPatientDiscoveryResp {
  const acknowledgementDetail =
    getPatientRegistryProfile(jsonObj)?.acknowledgement?.acknowledgementDetail;
  const issue = {
    severity: "error",
    code: acknowledgementDetail?.code?._code ?? "UK",
    details: {
      text:
        acknowledgementDetail?.text?._text ??
        acknowledgementDetail?.text ??
        acknowledgementDetail?.location ??
        "unknown",
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
    patientMatch: null,
    operationOutcome: operationOutcome,
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
  const { ack, queryResponseCode } = getAckAndQueryResponseCodeFromPatientRegistryProfile(jsonObj);

  if (isApplicationAccept(ack) && isXCPDRespOk(queryResponseCode)) {
    log(`Found a match for cxId: ${cxId} patient: ${patientId}`);
    return handlePatientMatchResponse({
      jsonObj,
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
      jsonObj,
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

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPatientRegistryProfile(jsonObj: any): any {
  return jsonObj?.Envelope?.Body?.PRPA_IN201306UV02;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAckAndQueryResponseCodeFromPatientRegistryProfile(jsonObj: any): {
  ack: string;
  queryResponseCode: string;
} {
  return {
    ack: getPatientRegistryProfile(jsonObj)?.acknowledgement?.typeCode?._code,
    queryResponseCode:
      getPatientRegistryProfile(jsonObj)?.controlActProcess?.queryAck?.queryResponseCode?._code,
  };
}
