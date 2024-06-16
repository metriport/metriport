import dayjs from "dayjs";
import {
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  OperationOutcome,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { capture } from "../../../../../../util/notifications";
import { out } from "../../../../../../util/log";
import { RegistryErrorList, RegistryError } from "./schema";
import { toArray } from "@metriport/shared";

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
    const registryErrors = toArray(registryErrorList?.RegistryError);
    registryErrors.forEach((entry: RegistryError) => {
      const issue = {
        severity: "error",
        code: entry?._errorCode?.toString() ?? "unknown-error",
        details: {
          text: entry?._codeContext?.toString() ?? "No details",
        },
      };

      operationOutcome.issue.push(issue);
    });

    const msg = "RegistryErrorList is present in response";
    capture.error(msg, {
      extra: {
        outboundRequest,
        registryErrorList,
        outboundRequestId: outboundRequest.id,
      },
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

export async function handleRegistryErrorResponse({
  registryErrorList,
  outboundRequest,
  gateway,
  attempt,
}: {
  registryErrorList: RegistryErrorList;
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  attempt?: number | undefined;
}): Promise<OutboundDocumentQueryResp | OutboundDocumentRetrievalResp> {
  const operationOutcome = processRegistryErrorList(registryErrorList, outboundRequest);
  return {
    id: outboundRequest.id,
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    operationOutcome,
    retried: attempt,
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
    responseTimestamp: dayjs().toISOString(),
    gateway: gateway,
    patientId: outboundRequest.patientId,
    operationOutcome: operationOutcome,
    retried: attempt,
    iheGatewayV2: true,
  };
}

export async function handleEmptyResponse({
  outboundRequest,
  gateway,
  text = "No documents found",
  attempt,
}: {
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  text?: string;
  attempt?: number | undefined;
}): Promise<OutboundDocumentQueryResp | OutboundDocumentRetrievalResp> {
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
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    operationOutcome,
    retried: attempt,
    iheGatewayV2: true,
  };
}

export async function handleSchemaErrorResponse({
  outboundRequest,
  gateway,
  attempt,
  text = "Schema Error",
}: {
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  attempt?: number | undefined;
  text?: string;
}): Promise<OutboundDocumentQueryResp | OutboundDocumentRetrievalResp> {
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
  return {
    id: outboundRequest.id,
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    operationOutcome,
    retried: attempt,
    iheGatewayV2: true,
  };
}

export function isRetryable(outboundRequest: OutboundDocumentRetrievalResp): boolean {
  return (
    outboundRequest.operationOutcome?.issue.some(
      issue =>
        issue.severity === "error" &&
        !knownNonRetryableErrors.some(
          nonRetryableError =>
            "text" in issue.details && issue.details.text.includes(nonRetryableError)
        )
    ) ?? false
  );
}
