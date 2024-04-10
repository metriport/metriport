import { XMLParser } from "fast-xml-parser";
import {
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryReq,
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
  XCPDGateway,
  OperationOutcome,
} from "@metriport/ihe-gateway-sdk";
import { normalizeGender } from "./utils";
import { capture } from "../../../util/notifications";

function handleHTTPErrorResponse({
  httpError,
  outboundRequest,
  gateway,
}: {
  httpError: string;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}): OutboundPatientDiscoveryResp {
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
    patientId: outboundRequest.patientId || "",
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
    jsonObj?.["Envelope"]?.["Body"]?.["PRPA_IN201306UV02"]?.["controlActProcess"]?.["subject"]?.[
      "registrationEvent"
    ]?.["subject1"];
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
        context: `lambda.girth-outbound-patient-discovery`,
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
      context: `lambda.girth-outbound-patient-discovery`,
      outboundRequest,
      gateway,
      patientId,
      cxId,
    },
  });
  const acknowledgementDetail =
    jsonObj?.["Envelope"]?.["Body"]?.["PRPA_IN201306UV02"]?.["acknowledgement"]?.[
      "acknowledgementDetail"
    ];
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
    patientId: outboundRequest.patientId || "",
    patientMatch: null,
    operationOutcome: operationOutcome,
  };

  try {
    outboundPatientDiscoveryRespFaultSchema.parse(response);
  } catch (error) {
    capture.error("Failed to validate outboundPatientDiscoveryRespFaultSchema", {
      extra: {
        context: `lambda.girth-outbound-patient-discovery`,
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
    patientId: outboundRequest.patientId || "",
    patientMatch: false,
    operationOutcome: operationOutcome,
  };
  return response;
}

export function processXCPDResponse({
  xmlStringOrError,
  outboundRequest,
  gateway,
  patientId,
  cxId,
}: {
  xmlStringOrError: string | { error: string };
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
  patientId?: string;
  cxId?: string;
}): OutboundPatientDiscoveryResp {
  if (typeof xmlStringOrError === "object" && xmlStringOrError.error) {
    return handleHTTPErrorResponse({
      httpError: xmlStringOrError.error,
      outboundRequest,
      gateway,
    });
  } else {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      removeNSPrefix: true,
    });

    if (typeof xmlStringOrError !== "string") {
      throw new Error("xmlStringOrError is not a string");
    }
    const jsonObj = parser.parse(xmlStringOrError);

    const ack =
      jsonObj?.["Envelope"]?.["Body"]?.["PRPA_IN201306UV02"]?.["acknowledgement"]?.["typeCode"]?.[
        "@_code"
      ];

    const queryResponseCode =
      jsonObj?.["Envelope"]?.["Body"]?.["PRPA_IN201306UV02"]?.["controlActProcess"]?.["queryAck"]?.[
        "queryResponseCode"
      ]?.["@_code"];

    if (ack === "AA" && queryResponseCode === "OK") {
      return handlePatientMatchResponse({
        jsonObj,
        outboundRequest,
        gateway,
      });
    } else if (ack === "AA" && queryResponseCode === "NF") {
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
}
