import {
  OperationOutcome,
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { CODE_SYSTEM_ERROR, errorToString, toArray } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { out } from "../../../../../../util/log";
import { capture } from "../../../../../../util/notifications";
import { httpErrorCode, schemaErrorCode } from "../../../../error";
import { RegistryError, RegistryErrorList } from "./schema";

const { log } = out("XCA Error Handling");
const knownNonRetryableErrors = ["No active consent for patient id"];

export function processRegistryErrorList(
  registryErrorList: RegistryErrorList,
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq
): OperationOutcome | undefined {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [],
  };

  try {
    if (typeof registryErrorList !== "object") return undefined;
    const registryErrors = toArray(registryErrorList?.RegistryError);
    registryErrors.forEach((entry: RegistryError) => {
      const issue = {
        severity: "error",
        code: entry?._errorCode?.toString() ?? "unknown-error",
        details: {
          text: entry?._codeContext?.toString() ?? "No details",
          coding: [
            {
              code: entry?._errorCode?.toString() ?? "",
              system: CODE_SYSTEM_ERROR,
            },
          ],
        },
      };

      operationOutcome.issue.push(issue);
    });
  } catch (error) {
    const msg = "Error processing RegistryErrorList";
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        error,
        outboundRequest,
        registryErrorList,
      },
    });
  }

  return operationOutcome.issue.length > 0 ? operationOutcome : undefined;
}

export function handleRegistryErrorResponse({
  registryErrorList,
  outboundRequest,
  gateway,
}: {
  registryErrorList: RegistryErrorList;
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
}): OutboundDocumentQueryResp | OutboundDocumentRetrievalResp {
  const operationOutcome = processRegistryErrorList(registryErrorList, outboundRequest);
  const baseResponse: OutboundDocumentQueryResp | OutboundDocumentRetrievalResp = {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    patientId: outboundRequest.patientId,
    cxId: outboundRequest.cxId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: buildDayjs().toISOString(),
    gateway,
    operationOutcome,
  };

  // Include requestedDocumentCount for DR requests to track how many documents failed
  if ("documentReference" in outboundRequest) {
    const drResponse: OutboundDocumentRetrievalResp = {
      ...baseResponse,
      requestedDocumentCount: outboundRequest.documentReference.length,
    };
    if ("originalRequestId" in outboundRequest) {
      drResponse.originalRequestId = outboundRequest.originalRequestId;
    }
    return drResponse;
  }
  return baseResponse;
}

export function handleHttpErrorResponse({
  httpError,
  outboundRequest,
  gateway,
  attempt,
}: {
  httpError: string;
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  attempt?: number | undefined;
}): OutboundDocumentQueryResp | OutboundDocumentRetrievalResp {
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
  const baseResponse = {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: buildDayjs().toISOString(),
    gateway: gateway,
    patientId: outboundRequest.patientId,
    cxId: outboundRequest.cxId,
    operationOutcome: operationOutcome,
    retried: attempt,
  };
  // Include requestedDocumentCount for DR requests to track how many documents failed
  if ("documentReference" in outboundRequest) {
    const drResponse: OutboundDocumentRetrievalResp = {
      ...baseResponse,
      requestedDocumentCount: outboundRequest.documentReference.length,
    };
    if ("originalRequestId" in outboundRequest) {
      drResponse.originalRequestId = outboundRequest.originalRequestId;
    }
    return drResponse;
  }
  return baseResponse;
}

export function handleEmptyResponse({
  outboundRequest,
  gateway,
  text = "No documents found",
}: {
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  text?: string;
}): OutboundDocumentQueryResp | OutboundDocumentRetrievalResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      {
        severity: "information",
        code: "no-documents-found",
        details: {
          text,
        },
      },
    ],
  };
  const baseResponse = {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    patientId: outboundRequest.patientId,
    cxId: outboundRequest.cxId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: buildDayjs().toISOString(),
    gateway,
    operationOutcome,
  };
  // Include requestedDocumentCount for DR requests to track how many documents failed
  if ("documentReference" in outboundRequest) {
    const drResponse: OutboundDocumentRetrievalResp = {
      ...baseResponse,
      requestedDocumentCount: outboundRequest.documentReference.length,
    };
    if ("originalRequestId" in outboundRequest) {
      drResponse.originalRequestId = outboundRequest.originalRequestId;
    }
    return drResponse;
  }
  return baseResponse;
}

export function handleSchemaErrorResponse({
  outboundRequest,
  gateway,
  text = "Schema Error",
}: {
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  text?: string;
}): OutboundDocumentQueryResp | OutboundDocumentRetrievalResp {
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
  const baseResponse = {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    patientId: outboundRequest.patientId,
    cxId: outboundRequest.cxId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: buildDayjs().toISOString(),
    gateway,
    operationOutcome,
  };
  // Include requestedDocumentCount for DR requests to track how many documents failed
  if ("documentReference" in outboundRequest) {
    const drResponse: OutboundDocumentRetrievalResp = {
      ...baseResponse,
      requestedDocumentCount: outboundRequest.documentReference.length,
    };
    if ("originalRequestId" in outboundRequest) {
      drResponse.originalRequestId = outboundRequest.originalRequestId;
    }
    return drResponse;
  }
  return baseResponse;
}

/**
 * Retries if the response has an error that is not in the known non-retryable errors list
 * Will not retry if the response is successful and is not an error.
 */
export function isRetryable(
  outboundResponse: OutboundDocumentRetrievalResp | OutboundDocumentQueryResp | undefined
): boolean {
  if (!outboundResponse) return false;
  return (
    outboundResponse.operationOutcome?.issue.some(
      issue =>
        issue.severity === "error" &&
        issue.code !== httpErrorCode &&
        issue.code !== schemaErrorCode &&
        !knownNonRetryableErrors.some(nonRetryableError =>
          issue.details.text?.includes(nonRetryableError)
        )
    ) ?? false
  );
}
