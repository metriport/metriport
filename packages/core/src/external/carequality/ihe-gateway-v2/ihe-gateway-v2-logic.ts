import {
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { executeWithNetworkRetries, executeWithRetries } from "@metriport/shared";
import axios from "axios";
import { capture } from "../../../util/notifications";
import { createAndSignBulkDQRequests, SignedDqRequest } from "./outbound/xca/create/iti38-envelope";
import { createAndSignBulkDRRequests, SignedDrRequest } from "./outbound/xca/create/iti39-envelope";
import { processDqResponse } from "./outbound/xca/process/dq-response";
import { processDrResponse } from "./outbound/xca/process/dr-response";
import { isRetryable as isRetryableXca } from "./outbound/xca/process/error";
import { isRetryable as isRetryableXcpd } from "./outbound/xcpd/process/error";
import { sendSignedDqRequest } from "./outbound/xca/send/dq-requests";
import { sendSignedDrRequest } from "./outbound/xca/send/dr-requests";
import {
  createAndSignBulkXCPDRequests,
  SignedXcpdRequest,
} from "./outbound/xcpd/create/iti55-envelope";
import { processXCPDResponse } from "./outbound/xcpd/process/xcpd-response";
import { sendSignedXcpdRequest } from "./outbound/xcpd/send/xcpd-requests";
import { SamlCertsAndKeys } from "./saml/security/types";

export async function sendProcessRetryXcpdRequest({
  signedRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  signedRequest: SignedXcpdRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<OutboundPatientDiscoveryResp> {
  async function sendProcessXcpdRequest() {
    const response = await sendSignedXcpdRequest({
      request: signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    return processXCPDResponse({
      xcpdResponse: response,
      patientId,
      cxId,
    });
  }

  return await executeWithRetries(sendProcessXcpdRequest, {
    initialDelay: 3000,
    maxAttempts: 3,
    shouldRetry: isRetryableXcpd,
  });
}

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
    return processDqResponse({
      response,
    });
  }

  return await executeWithRetries(sendProcessDqRequest, {
    initialDelay: 3000,
    maxAttempts: 3,
    shouldRetry: isRetryableXca,
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
    shouldRetry: isRetryableXca,
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
  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    const result = await sendProcessRetryXcpdRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    try {
      await executeWithNetworkRetries(async () => axios.post(pdResponseUrl, result));
    } catch (error) {
      capture.error("Failed to send PD response to Internal Carequality Endpoint", {
        extra: {
          cxId,
          patientId,
          error,
          result,
        },
      });
    }
  });

  await Promise.allSettled(resultPromises);
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
    const result = await sendProcessRetryDqRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    try {
      await executeWithNetworkRetries(async () => axios.post(dqResponseUrl, result));
    } catch (error) {
      capture.error("Failed to send DQ response to Internal Carequality Endpoint", {
        extra: {
          cxId,
          patientId,
          error,
          result,
        },
      });
    }
  });

  await Promise.allSettled(resultPromises);
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
    const result = await sendProcessRetryDrRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    try {
      await executeWithNetworkRetries(async () => axios.post(drResponseUrl, result));
    } catch (error) {
      capture.error("Failed to send DR response to Internal Carequality Endpoint", {
        extra: {
          cxId,
          patientId,
          error,
          result,
        },
      });
    }
  });

  await Promise.allSettled(resultPromises);
}
