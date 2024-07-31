import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
  XCPDGateway,
  OutboundPatientDiscoveryRespFaultSchema,
  OperationOutcome,
} from "@metriport/ihe-gateway-sdk";
import { PatientRegistryProfile } from "./schema";
import { extractText } from "../../../utils";
import { httpErrorCode, schemaErrorCode } from "../../../../error";

export function handleHttpErrorResponse({
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
        code: httpErrorCode,
        details: {
          text: httpError,
        },
      },
    ],
  };
  return {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway,
    patientId: outboundRequest?.patientId,
    patientMatch: null,
    iheGatewayV2: true,
    operationOutcome,
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
      ...(acknowledgementDetail?.code?._code &&
        acknowledgementDetail?.code?._codeSystem && {
          coding: [
            {
              code: acknowledgementDetail.code._code,
              system: acknowledgementDetail.code._codeSystem,
            },
          ],
        }),
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
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway,
    patientId: outboundRequest.patientId,
    patientMatch: null,
    iheGatewayV2: true,
    operationOutcome,
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
        code: schemaErrorCode,
        details: {
          text,
        },
      },
    ],
  };
  const response: OutboundPatientDiscoveryResp = {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway,
    patientId: outboundRequest.patientId,
    patientMatch: null,
    iheGatewayV2: true,
    operationOutcome,
  };
  return response;
}

/**
 * For now lets not retry on any error. We have network retries already.
 */
export function isRetryable(outboundResponse: OutboundPatientDiscoveryResp | undefined): boolean {
  if (!outboundResponse) return false;
  return false;
}
