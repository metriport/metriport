import {
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { errorToString, executeWithNetworkRetries, executeWithRetries } from "@metriport/shared";
import axios from "axios";
import { log as getLog } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { createAndSignBulkDQRequests, SignedDqRequest } from "./outbound/xca/create/iti38-envelope";
import { createAndSignBulkDRRequests, SignedDrRequest } from "./outbound/xca/create/iti39-envelope";
import { processDqResponse } from "./outbound/xca/process/dq-response";
import { processDrResponse } from "./outbound/xca/process/dr-response";
import { isRetryable } from "./outbound/xca/process/error";
import { sendSignedDqRequest } from "./outbound/xca/send/dq-requests";
import { sendSignedDrRequest } from "./outbound/xca/send/dr-requests";
import { createAndSignBulkXCPDRequests } from "./outbound/xcpd/create/iti55-envelope";
import { processXCPDResponse } from "./outbound/xcpd/process/xcpd-response";
import { sendSignedXCPDRequests } from "./outbound/xcpd/send/xcpd-requests";
import { SamlCertsAndKeys } from "./saml/security/types";

export async function sendProcessRetryDqRequest({
  signedRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  signedRequest: SignedDqRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<OutboundDocumentQueryResp> {
  async function sendProcessDqRequest() {
    const response = await sendSignedDqRequest({
      request: signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    return await processDqResponse({
      response,
    });
  }

  return await executeWithRetries(sendProcessDqRequest, {
    initialDelay: 3000,
    maxAttempts: 3,
    shouldRetry: isRetryable,
  });
}

export async function sendProcessRetryDrRequest({
  signedRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  signedRequest: SignedDrRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<OutboundDocumentRetrievalResp> {
  async function sendProcessDrRequest() {
    const response = await sendSignedDrRequest({
      request: signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    return await processDrResponse({
      response,
    });
  }

  return await executeWithRetries(sendProcessDrRequest, {
    initialDelay: 3000,
    maxAttempts: 3,
    shouldRetry: isRetryable,
  });
}

export async function createSignSendProcessXCPDRequest({
  pdResponseUrl,
  xcpdRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  pdResponseUrl: string;
  xcpdRequest: OutboundPatientDiscoveryReq;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkXCPDRequests(xcpdRequest, samlCertsAndKeys);
  const responses = await sendSignedXCPDRequests({
    signedRequests,
    samlCertsAndKeys,
    patientId,
    cxId,
  });
  const results: OutboundPatientDiscoveryResp[] = responses.map(response => {
    return processXCPDResponse({
      xcpdResponse: response,
      patientId,
      cxId,
    });
  });
  for (const result of results) {
    try {
      // TODO not sure if we should retry on timeout
      await executeWithNetworkRetries(async () => axios.post(pdResponseUrl, result));
    } catch (error) {
      const msg = "Failed to send PD response to internal CQ endpoint";
      const extra = { cxId, patientId, result };
      const log = getLog("createSignSendProcessXCPDRequest");
      log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
      capture.error(msg, { extra: { ...extra, error } });
    }
  }
}

export async function createSignSendProcessDqRequests({
  dqResponseUrl,
  dqRequestsGatewayV2,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  dqResponseUrl: string;
  dqRequestsGatewayV2: OutboundDocumentQueryReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkDQRequests({
    bulkBodyData: dqRequestsGatewayV2,
    samlCertsAndKeys,
  });

  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    return sendProcessRetryDqRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
  });

  const results = await Promise.allSettled(resultPromises);
  const successfulResults = results
    .filter(
      (result): result is PromiseFulfilledResult<OutboundDocumentQueryResp> =>
        result.status === "fulfilled"
    )
    .map(result => result.value);
  for (const result of successfulResults) {
    try {
      // TODO not sure if we should retry on timeout
      await executeWithNetworkRetries(async () => axios.post(dqResponseUrl, result));
    } catch (error) {
      const msg = "Failed to send DQ response to internal CQ endpoint";
      const extra = { cxId, patientId, result };
      const log = getLog("createSignSendProcessDQRequests");
      log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
      capture.error(msg, { extra: { ...extra, error } });
    }
  }
}

export async function createSignSendProcessDrRequests({
  drResponseUrl,
  drRequestsGatewayV2,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  drResponseUrl: string;
  drRequestsGatewayV2: OutboundDocumentRetrievalReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkDRRequests({
    bulkBodyData: drRequestsGatewayV2,
    samlCertsAndKeys,
  });

  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    return sendProcessRetryDrRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
  });

  const results = await Promise.allSettled(resultPromises);
  const successfulResults = results
    .filter(
      (result): result is PromiseFulfilledResult<OutboundDocumentRetrievalResp> =>
        result.status === "fulfilled"
    )
    .map(result => result.value);

  for (const result of successfulResults) {
    try {
      // TODO not sure if we should retry on timeout
      await executeWithNetworkRetries(async () => axios.post(drResponseUrl, result));
    } catch (error) {
      const msg = "Failed to send DR response to internal CQ endpoint";
      const extra = { cxId, patientId, result };
      const log = getLog("createSignSendProcessDRRequests");
      log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
      capture.error(msg, { extra: { ...extra, error } });
    }
  }
}
