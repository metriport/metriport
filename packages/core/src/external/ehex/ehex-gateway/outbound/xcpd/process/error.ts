import {
  Issue,
  OperationOutcome,
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
  XCPDGateway,
} from "@metriport/ihe-gateway-sdk";
import { buildDayjs } from "@metriport/shared/common/date";
import { HTTP_STATUS_CODE_EXTENSION_URL } from "../../../../../fhir/shared/extensions/http";
import { httpErrorCode, schemaErrorCode } from "../../../../error";
import { extractText } from "../../../utils";
import { EhexOutboundPatientDiscoveryResp } from "./types";
import { PatientRegistryProfile } from "./schema";

export function handleHttpErrorResponse({
  httpError,
  responseHttpStatusCode,
  outboundRequest,
  gateway,
}: {
  httpError: string;
  responseHttpStatusCode: number;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}): EhexOutboundPatientDiscoveryResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [buildFhirIssueForHttpError({ httpError, httpStatusCode: responseHttpStatusCode })],
  };
  const responseTimestamp = buildDayjs();
  return {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: responseTimestamp.toISOString(),
    duration: responseTimestamp.diff(outboundRequest.timestamp),
    gateway,
    patientId: outboundRequest?.patientId,
    cxId: outboundRequest.cxId,
    patientMatch: null,
    operationOutcome,
    responseHttpStatusCode,
  };
}

function buildFhirIssueForHttpError({
  httpError,
  httpStatusCode,
}: {
  httpError: string;
  httpStatusCode: number;
}): Issue {
  return {
    severity: "error",
    code: httpErrorCode,
    details: {
      text: httpError,
      coding: [
        {
          system: HTTP_STATUS_CODE_EXTENSION_URL,
          code: httpStatusCode.toString(),
        },
      ],
    },
  };
}

export function handlePatientErrorResponse({
  patientRegistryProfile,
  outboundRequest,
  gateway,
  responseHttpStatusCode,
}: {
  patientRegistryProfile: PatientRegistryProfile;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
  responseHttpStatusCode: number;
}): EhexOutboundPatientDiscoveryResp {
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
  const responseTimestamp = buildDayjs();
  const response: OutboundPatientDiscoveryResp = {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: responseTimestamp.toISOString(),
    duration: responseTimestamp.diff(outboundRequest.timestamp),
    gateway,
    patientId: outboundRequest.patientId,
    cxId: outboundRequest.cxId,
    patientMatch: null,
    operationOutcome,
    responseHttpStatusCode,
  };
  return response;
}

export function handleSchemaErrorResponse({
  outboundRequest,
  gateway,
  text = "Zod Schema Error",
  responseHttpStatusCode,
}: {
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
  text?: string;
  responseHttpStatusCode: number;
}): EhexOutboundPatientDiscoveryResp {
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
    responseTimestamp: buildDayjs().toISOString(),
    gateway,
    patientId: outboundRequest.patientId,
    cxId: outboundRequest.cxId,
    patientMatch: null,
    operationOutcome,
    responseHttpStatusCode,
  };
  return response;
}

/**
 * For now lets not retry on any error. We have network retries already.
 */
export function isRetryable(
  outboundResponse: EhexOutboundPatientDiscoveryResp | undefined
): boolean {
  if (!outboundResponse) return false;
  return false;
}
