import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
  XCPDGateway,
  OutboundPatientDiscoveryRespFaultSchema,
  OperationOutcome,
} from "@metriport/ihe-gateway-sdk";
import { PatientRegistryProfile } from "./schema";
import { extractText } from "../../../utils";

export function handleHTTPErrorResponse({
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

export function handlePatientErrorResponse({
  patientRegistryProfile,
  outboundRequest,
  gateway,
}: {
  patientRegistryProfile: PatientRegistryProfile;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
  patientId?: string | undefined;
  cxId?: string | undefined;
}): OutboundPatientDiscoveryResp {
  const acknowledgementDetail = patientRegistryProfile.acknowledgement?.acknowledgementDetail;
  const issue = {
    severity: "error",
    code: acknowledgementDetail?.code?._code ?? "UK",
    details: {
      text: acknowledgementDetail?.text
        ? extractText(acknowledgementDetail.text)
        : acknowledgementDetail?.location ?? "unknown",
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

export function handleSchemaErrorResponse({
  outboundRequest,
  gateway,
  text = "Zod Schema Error",
}: {
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
  text?: string;
}): OutboundPatientDiscoveryResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      {
        severity: "error",
        code: "schema-error",
        details: {
          text,
        },
      },
    ],
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
