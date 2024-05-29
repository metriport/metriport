import { XMLParser } from "fast-xml-parser";
import {
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryRespFaultSchema,
  OutboundPatientDiscoveryReq,
  XCPDGateway,
  OperationOutcome,
} from "@metriport/ihe-gateway-sdk";
import { normalizeGender } from "../../../utils";
import { XCPDSamlClientResponse } from "../send/xcpd-requests";
import { out } from "../../../../../../util/log";
import { toArray } from "../../../utils";

const { log } = out("Processing XCPD Requests");

type IheAddress = {
  streetAddressLine: string | string[] | undefined;
  city: string | undefined;
  state: string | undefined;
  postalCode: string | undefined;
  country: string | undefined;
  county: string | undefined;
};

type CarequalityAddress = {
  line: string[] | undefined;
  city: string | undefined;
  state: string | undefined;
  postalCode: string | undefined;
  country: string | undefined;
};

type IheName = {
  given: string | string[] | undefined;
  family: string | undefined;
  delimiter: string | undefined;
};

type CarequalityName = {
  given: string[];
  family: string | undefined;
};

export function convertIheAddressToCarequalityAddress(address: IheAddress): CarequalityAddress {
  return {
    line: toArray(address?.streetAddressLine).filter((l): l is string => Boolean(l)),
    city: address?.city ? String(address?.city) : undefined,
    state: address?.state ? String(address?.state) : undefined,
    postalCode: address?.postalCode ? String(address?.postalCode) : undefined,
    country: address?.country ? String(address?.country) : undefined,
  };
}

function iheAddressesToCarequalityAddresses(iheAddresses: IheAddress[]): CarequalityAddress[] {
  return iheAddresses.map(convertIheAddressToCarequalityAddress);
}

function convertIheNameToCarequalityName(name: IheName): CarequalityName {
  return {
    given: toArray(name?.given).filter((g): g is string => Boolean(g)),
    family: name?.family ? String(name?.family) : undefined,
  };
}

function iheNamesToCarequalityNames(iheNames: IheName[]): CarequalityName[] {
  return iheNames.map(convertIheNameToCarequalityName);
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

  const addresses = iheAddressesToCarequalityAddresses(addr);
  const patientNames = iheNamesToCarequalityNames(names);

  const patientResource = {
    name: patientNames,
    gender: normalizeGender(subject1?.patient?.patientPerson?.administrativeGenderCode?._code),
    birthDate: subject1?.patient?.patientPerson?.birthTime?._value,
    address: addresses,
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
    ...(acknowledgementDetail && {
      code: acknowledgementDetail?.code?._code,
      details: {
        text:
          acknowledgementDetail?.text?._text ??
          acknowledgementDetail?.text ??
          acknowledgementDetail?.location,
      },
    }),
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
