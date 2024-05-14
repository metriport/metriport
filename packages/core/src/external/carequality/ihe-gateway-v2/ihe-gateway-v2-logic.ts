import axios from "axios";
import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import { SamlCertsAndKeys } from "./saml/security/types";
import { createAndSignBulkXCPDRequests } from "./outbound/xcpd/create/iti55-envelope";
import { createAndSignBulkDQRequests } from "./outbound/xca/create/iti38-envelope";
import { createAndSignBulkDRRequests } from "./outbound/xca/create/iti39-envelope";
import { sendSignedXCPDRequests } from "./outbound/xcpd/send/xcpd-requests";
import { sendSignedDQRequests } from "./outbound/xca/send/dq-requests";
import { sendSignedDRRequests } from "./outbound/xca/send/dr-requests";
import { processXCPDResponse } from "./outbound/xcpd/process/xcpd-response";
import { processDQResponse } from "./outbound/xca/process/dq-response";
import { processDRResponse } from "./outbound/xca/process/dr-response";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { S3Utils } from "../../aws/s3";

const region = Config.getAWSRegion();

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
      await axios.post(pdResponseUrl, result);
    } catch (error) {
      capture.error("Failed to send PD response to Internal Carequality Endpoint", {
        extra: {
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
      await axios.post(dqResponseUrl, result);
    } catch (error) {
      capture.error("Failed to send DQ response to Internal Carequality Endpoint", {
        extra: {
          error,
          result,
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
  const s3Utils = new S3Utils(region);
  const results = await Promise.all(
    responses.map(async response => {
      return await processDRResponse({
        drResponse: response,
        s3Utils,
      });
    })
  );
  for (const result of results) {
    try {
      await axios.post(drResponseUrl, result);
    } catch (error) {
      capture.error("Failed to send DR response to Internal Carequality Endpoint", {
        extra: {
          error,
          result,
        },
      });
    }
  }
}
