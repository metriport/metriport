import {
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";

import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import { capture } from "../../../util/notifications";
import { createAndSignBulkDQRequests } from "./outbound/xca/create/iti38-envelope";
import { createAndSignBulkDRRequests } from "./outbound/xca/create/iti39-envelope";
import { processDQResponse } from "./outbound/xca/process/dq-response";
import { processDrResponse } from "./outbound/xca/process/dr-response";
import { sendSignedDQRequests } from "./outbound/xca/send/dq-requests";
import { sendSignedDRRequests } from "./outbound/xca/send/dr-requests";
import { createAndSignBulkXCPDRequests } from "./outbound/xcpd/create/iti55-envelope";
import { processXCPDResponse } from "./outbound/xcpd/process/xcpd-response";
import { sendSignedXCPDRequests } from "./outbound/xcpd/send/xcpd-requests";
import { errorToString } from "../../../util/error/shared";
import { SamlCertsAndKeys } from "./saml/security/types";
import { out } from "../../../util/log";

const { log } = out("IHE Gateway V2");

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
      await executeWithNetworkRetries(async () => axios.post(pdResponseUrl, result));
    } catch (error) {
      const errorString = errorToString(error);
      log(errorString);
      capture.error("Failed to send PD response to Internal Carequality Endpoint", {
        extra: {
          cxId,
          patientId,
          error,
          result,
        },
      });
    }
  }
}

export async function createSignSendProcessDQRequests({
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
  const responses = await sendSignedDQRequests({
    signedRequests,
    samlCertsAndKeys,
    patientId,
    cxId,
  });
  const results = responses.map(response => {
    return processDQResponse({
      dqResponse: response,
    });
  });
  for (const result of results) {
    try {
      await executeWithNetworkRetries(async () => axios.post(dqResponseUrl, result));
    } catch (error) {
      const errorString = errorToString(error);
      log(errorString);
      capture.error("Failed to send DQ response to Internal Carequality Endpoint", {
        extra: {
          cxId,
          patientId,
          error,
          result,
          dqRequestsGatewayV2,
        },
      });
    }
  }
}

export async function createSignSendProcessDRRequests({
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
  const responses = await sendSignedDRRequests({
    signedRequests,
    samlCertsAndKeys,
    patientId,
    cxId,
  });
  const results = await Promise.all(
    responses.map(async response => {
      return await processDrResponse({
        drResponse: response,
      });
    })
  );
  for (const result of results) {
    try {
      await executeWithNetworkRetries(async () => axios.post(drResponseUrl, result));
    } catch (error) {
      const errorString = errorToString(error);
      log(errorString);
      capture.error("Failed to send DR response to Internal Carequality Endpoint", {
        extra: {
          cxId,
          patientId,
          error,
          result,
          drRequestsGatewayV2,
        },
      });
    }
  }
}
