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
    log(`${msg}: ${error}`);
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

export function handleRegistryErrorResponseDq({
  registryErrorList,
  outboundRequest,
  gateway,
}: {
  registryErrorList: RegistryErrorList;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
}): OutboundDocumentQueryResp {
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

export function handleRegistryErrorResponseDr({
  registryErrorList,
  outboundRequest,
  gateway,
}: {
  registryErrorList: RegistryErrorList;
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
}): OutboundDocumentRetrievalResp {
  const baseOperationOutcome = processRegistryErrorList(registryErrorList, outboundRequest);
  const operationOutcome: OperationOutcome = {
    ...baseOperationOutcome,
    id: outboundRequest.id,
    resourceType: "OperationOutcome",
    issue: [
      ...(baseOperationOutcome?.issue ?? []),
      ...outboundRequest.documentReference.map(doc => ({
        id: doc.metriportId,
        severity: "error",
        code: "registry-error",
        details: {
          id: doc.docUniqueId,
          text: `Registry error for document with metriportId ${doc.metriportId} and docUniqueId ${doc.docUniqueId}`,
        },
      })),
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

export function handleHttpErrorResponseDq({
  httpError,
  outboundRequest,
  gateway,
  attempt,
}: {
  httpError: string;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
  attempt?: number | undefined;
}): OutboundDocumentQueryResp {
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
    gateway,
    patientId: outboundRequest.patientId,
    operationOutcome,
    retried: attempt,
    iheGatewayV2: true,
  };
}

export function handleHttpErrorResponseDr({
  httpError,
  outboundRequest,
  gateway,
  attempt,
}: {
  httpError: string;
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  attempt?: number | undefined;
}): OutboundDocumentRetrievalResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      ...outboundRequest.documentReference.map(doc => ({
        id: doc.metriportId,
        severity: "error",
        code: httpErrorCode,
        details: {
          id: doc.docUniqueId,
          text: `${httpError} for document with metriportId ${doc.metriportId} and docUniqueId ${doc.docUniqueId}`,
        },
      })),
    ],
  };
  return {
    id: outboundRequest.id,
    requestChunkId: outboundRequest.requestChunkId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    patientId: outboundRequest.patientId,
    operationOutcome,
    retried: attempt,
    iheGatewayV2: true,
  };
}

export function handleEmptyResponseDq({
  outboundRequest,
  gateway,
  text = "No documents found",
}: {
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
  text?: string;
}): OutboundDocumentQueryResp {
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

export function handleEmptyResponseDr({
  outboundRequest,
  gateway,
}: {
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  text?: string;
}): OutboundDocumentRetrievalResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      ...outboundRequest.documentReference.map(doc => ({
        id: doc.metriportId,
        severity: "information",
        code: "document-not-found",
        details: {
          id: doc.docUniqueId,
          text: `Document with metriportId ${doc.metriportId} and docUniqueId ${doc.docUniqueId} not found`,
        },
      })),
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

export function handleSchemaErrorResponseDq({
  outboundRequest,
  gateway,
  text = "Schema Error",
}: {
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
  text?: string;
}): OutboundDocumentQueryResp {
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

export function handleSchemaErrorResponseDr({
  outboundRequest,
  gateway,
  text = "Schema Error",
}: {
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  text?: string;
}): OutboundDocumentRetrievalResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      ...outboundRequest.documentReference.map(doc => ({
        id: doc.metriportId,
        severity: "error",
        code: schemaErrorCode,
        details: {
          id: doc.docUniqueId,
          text,
        },
      })),
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

export function generateOperationOutcomesForMissingDocuments(
  idMapping: Record<string, string>,
  processedIds: Set<string>,
  requestId: string
): OperationOutcome {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: requestId,
    issue: Object.entries(idMapping)
      .filter(([, metriportId]) => !processedIds.has(metriportId))
      .map(([docUniqueId, metriportId]) => ({
        id: metriportId,
        severity: "information",
        code: "document-not-found",
        details: {
          id: docUniqueId,
          text: `Document with metriportId ${metriportId} and id ${docUniqueId} not found`,
        },
      })),
  };
  return operationOutcome;
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
