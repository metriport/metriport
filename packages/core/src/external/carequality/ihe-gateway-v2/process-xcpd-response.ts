import { XMLParser } from "fast-xml-parser";
import {
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryRespFaultSchema,
  OutboundPatientDiscoveryReq,
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
  XCPDGateway,
  OperationOutcome,
} from "@metriport/ihe-gateway-sdk";
import { normalizeGender } from "./utils";
import { capture } from "../../../util/notifications";
import { SamlClientResponse } from "./saml-client";

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
    getPatientRegistryProfile(jsonObj)?.["controlActProcess"]?.["subject"]?.["registrationEvent"]?.[
      "subject1"
    ];
  const addr = subject1?.["patient"]?.["patientPerson"]?.["addr"];
  const addresses = [
    {
      line: [addr?.["streetAddressLine"]?.["#text"] ?? addr?.["streetAddressLine"]],
      city: addr?.["city"]?.["#text"] ?? addr?.["city"],
      state: addr?.["state"]?.["#text"] ?? addr?.["state"],
      postalCode: String(addr?.["postalCode"]?.["#text"] ?? addr?.["postalCode"]),
      country: addr?.["country"]?.["#text"] ?? addr?.["country"],
    },
  ];

  const patientResource = {
    name: [
      {
        given: [subject1?.["patient"]?.["patientPerson"]?.["name"]?.["given"]],
        family: subject1?.["patient"]?.["patientPerson"]?.["name"]?.["family"],
      },
    ],
    gender: normalizeGender(
      subject1?.["patient"]?.["patientPerson"]?.["administrativeGenderCode"]?.["@_code"]
    ),
    birthDate: subject1?.["patient"]?.["patientPerson"]?.["birthTime"]?.["@_value"],
    address: addresses,
  };

  const response: OutboundPatientDiscoveryResp = {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    externalGatewayPatient: {
      id: subject1?.["patient"]?.["id"]?.["@_extension"]?.toString(),
      system: subject1?.["patient"]?.["id"]?.["@_root"]?.toString(),
    },
    gateway: gateway,
    patientId: outboundRequest.patientId,
    patientMatch: true,
    gatewayHomeCommunityId: outboundRequest.samlAttributes.homeCommunityId,
    patientResource: patientResource,
  };

  try {
    outboundPatientDiscoveryRespSuccessfulSchema.parse(response);
  } catch (error) {
    capture.error("Failed to validate outboundPatientDiscoveryRespSuccessfulSchema", {
      extra: {
        context: `lambda.iheGatewayV2-outbound-patient-discovery`,
        response,
        error,
      },
    });
  }

  return response;
}

function handlePatientErrorResponse({
  jsonObj,
  outboundRequest,
  gateway,
  patientId,
  cxId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonObj: any;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
  patientId?: string | undefined;
  cxId?: string | undefined;
}): OutboundPatientDiscoveryResp {
  const msg = "An AbortedError (AE) was received from the responding gateway";
  capture.error(msg, {
    extra: {
      context: `lambda.iheGatewayV2-outbound-patient-discovery`,
      outboundRequest,
      gateway,
      patientId,
      cxId,
    },
  });
  const acknowledgementDetail =
    getPatientRegistryProfile(jsonObj)?.["acknowledgement"]?.["acknowledgementDetail"];
  const issue = {
    severity: "error",
    ...(acknowledgementDetail && {
      code: acknowledgementDetail?.["code"]?.["@_code"],
      details: {
        text: acknowledgementDetail?.["text"]?.["#text"] || acknowledgementDetail?.["text"],
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

  try {
    outboundPatientDiscoveryRespFaultSchema.parse(response);
  } catch (error) {
    capture.error("Failed to validate outboundPatientDiscoveryRespFaultSchema", {
      extra: {
        context: `lambda.iheGatewayV2-outbound-patient-discovery`,
        response,
        error,
      },
    });
  }
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
  xcpdResponse,
  outboundRequest,
  gateway,
  patientId,
  cxId,
}: {
  xcpdResponse: SamlClientResponse;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
  patientId?: string;
  cxId?: string;
}): OutboundPatientDiscoveryResp {
  if (xcpdResponse.success === false) {
    return handleHTTPErrorResponse({
      httpError: xcpdResponse.response,
      outboundRequest,
      gateway,
    });
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });

  const jsonObj = parser.parse(xcpdResponse.response);
  const { ack, queryResponseCode } = getAckAndQueryResponseCodeFromPatientRegistryProfile(jsonObj);

  if (isApplicationAccept(ack) && isXCPDRespOk(queryResponseCode)) {
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
      patientId,
      cxId,
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
  return jsonObj?.["Envelope"]?.["Body"]?.["PRPA_IN201306UV02"];
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAckAndQueryResponseCodeFromPatientRegistryProfile(jsonObj: any): {
  ack: string;
  queryResponseCode: string;
} {
  return {
    ack: getPatientRegistryProfile(jsonObj)?.["acknowledgement"]?.["typeCode"]?.["@_code"],
    queryResponseCode:
      getPatientRegistryProfile(jsonObj)?.["controlActProcess"]?.["queryAck"]?.[
        "queryResponseCode"
      ]?.["@_code"],
  };
}
