import { isRetryableError } from "../process/error";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import {
  OutboundDocumentRetrievalResp,
  OutboundDocumentQueryResp,
} from "@metriport/ihe-gateway-sdk";
import { SignedDqRequest } from "../create/iti38-envelope";
import { SignedDrRequest } from "../create/iti39-envelope";
import { sendSignedDqRequest } from "../send/dq-requests";
import { sendSignedDrRequest } from "../send/dr-requests";
import { processDqResponse } from "../process/dq-response";
import { processDrResponse } from "../process/dr-response";
import { out } from "../../../../../../util/log";

const { log } = out("IHE Gateway V2");

function calculateBackoff(attempt: number, baseDelay = 2000, jitterRange = 2000): number {
  const baseBackoffTime = Math.pow(2, attempt + 1) * baseDelay;
  const jitter = (Math.random() - 0.5) * jitterRange;
  return baseBackoffTime + jitter;
}

export async function sendProcessRetryRequests<T, R>({
  signedRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
  sendRequest,
  processResponse,
  maxRetries = 2,
}: {
  signedRequest: T;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
  sendRequest: (params: {
    request: T;
    samlCertsAndKeys: SamlCertsAndKeys;
    patientId: string;
    cxId: string;
    index: number;
  }) => Promise<R>;
  processResponse: (params: {
    response: R;
    attempt: number;
  }) => Promise<OutboundDocumentQueryResp | OutboundDocumentRetrievalResp>;
  maxRetries?: number;
}): Promise<OutboundDocumentQueryResp | OutboundDocumentRetrievalResp> {
  let attempt = 0;

  while (attempt < maxRetries) {
    const response = await sendRequest({
      request: signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    const result = await processResponse({
      response,
      attempt,
    });

    if (!isRetryableError(result)) {
      return result;
    }

    attempt++;
    const backoffTime = calculateBackoff(attempt);
    await new Promise(resolve => setTimeout(resolve, backoffTime));
    log(`Attempt ${attempt + 1} of ${maxRetries + 1}`);
  }

  const finalBackoffTime = calculateBackoff(maxRetries);
  await new Promise(resolve => setTimeout(resolve, finalBackoffTime));

  log(`Attempt ${maxRetries + 1} of ${maxRetries + 1}`);
  const finalResponse = await sendRequest({
    request: signedRequest,
    samlCertsAndKeys,
    patientId,
    cxId,
    index,
  });
  const result = await processResponse({
    response: finalResponse,
    attempt: maxRetries,
  });
  return result;
}

export async function sendProcessRetryDrRequests(params: {
  signedRequest: SignedDrRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<OutboundDocumentRetrievalResp> {
  return sendProcessRetryRequests({
    ...params,
    sendRequest: sendSignedDrRequest,
    processResponse: processDrResponse,
  });
}

export async function sendProcessRetryDqRequests(params: {
  signedRequest: SignedDqRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<OutboundDocumentQueryResp> {
  return sendProcessRetryRequests({
    ...params,
    sendRequest: sendSignedDqRequest,
    processResponse: processDqResponse,
  });
}
