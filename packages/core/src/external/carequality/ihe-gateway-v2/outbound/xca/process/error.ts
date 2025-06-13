import {
  OperationOutcome,
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { toArray } from "@metriport/shared";
import dayjs from "dayjs";
import { out } from "../../../../../../util/log";
import { capture } from "../../../../../../util/notifications";
import { RegistryError, RegistryErrorList } from "./schema";
import { CODE_SYSTEM_ERROR } from "../../../../shared";
import { httpErrorCode, schemaErrorCode } from "../../../../error";

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
    outLog(`${msg}: ${error}`);
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
  return {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    operationOutcome,
    iheGatewayV2: true,
  };
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
  return {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway: gateway,
    patientId: outboundRequest.patientId,
    operationOutcome: operationOutcome,
    retried: attempt,
    iheGatewayV2: true,
  };
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
  return {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    operationOutcome,
    iheGatewayV2: true,
  };
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
  return {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    operationOutcome,
    iheGatewayV2: true,
  };
}

/**
 * Checks if the response has an error that is not in the known non-retryable errors list
 * Will not retry if the response is successful and is not an error.
 */
export function shouldRetryResponse(
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

/**
 * Retries if the response has an error that is not in the known non-retryable errors list
 * Will not retry if the response is successful and is not an error.
 */
export function isRetryable(
  outboundResponse: OutboundDocumentRetrievalResp | OutboundDocumentQueryResp | undefined
): boolean {
  const shouldRetry = shouldRetryResponse(outboundResponse);

  if (shouldRetry && "document" in (outboundResponse ?? {})) {
    log(`Document retrieval response that will be retried: ${JSON.stringify(outboundResponse)}`);
  }

  return shouldRetry;
}
