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

const { log } = out("XCA Error Handling");

export function processRegistryErrorList(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  registryErrorList: any,
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq
): OperationOutcome | undefined {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [],
  };

  try {
    const registryErrors = Array.isArray(registryErrorList?.RegistryError)
      ? registryErrorList.RegistryError
      : [registryErrorList?.RegistryError];
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    registryErrors.forEach((entry: any) => {
      const issue = {
        severity: entry?._severity?.toString().toLowerCase().split(":").pop(),
        code: entry?._errorCode?.toString(),
        details: {
          text: entry?._codeContext?.toString(),
        },
      };

      operationOutcome.issue.push(issue);
    });

    const msg = "RegistryErrorList is present in response";
    capture.error(msg, {
      extra: {
        outboundRequest,
        registryErrorList,
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

export function handleRegistryErrorResponse({
  registryErrorList,
  outboundRequest,
  gateway,
}: {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  registryErrorList: any;
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
}): OutboundDocumentQueryResp | OutboundDocumentRetrievalResp {
  const operationOutcome = processRegistryErrorList(registryErrorList, outboundRequest);
  return {
    id: outboundRequest.id,
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    operationOutcome,
  };
}

export function handleHTTPErrorResponse({
  httpError,
  outboundRequest,
  gateway,
}: {
  httpError: string;
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
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
  };
}

export function handleEmptyResponse({
  outboundRequest,
  gateway,
}: {
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
}): OutboundDocumentQueryResp | OutboundDocumentRetrievalResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      {
        severity: "information",
        code: "no-documents-found",
        details: {
          text: "No documents found",
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
  };
}

export function handleSOAPFaultResponse({
  soapFault,
  outboundRequest,
  gateway,
}: {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  soapFault: any;
  outboundRequest: OutboundDocumentQueryReq | OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
}): OutboundDocumentQueryResp | OutboundDocumentRetrievalResp {
  const faultCode = soapFault?.Code?.Value?.toString() ?? "unknown_fault";
  const faultReason =
    soapFault?.Reason?.Text?._text.toString().trim() ?? "An unknown error occurred";

  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      {
        severity: "error",
        code: faultCode,
        details: {
          text: faultReason,
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
  };
}
