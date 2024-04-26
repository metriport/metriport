import axios from "axios";
import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import { SamlCertsAndKeys } from "../../saml/security/types";
import { createAndSignBulkXCPDRequests } from "../../saml/xcpd/iti55-envelope";
import { createAndSignBulkDQRequests } from "../../saml/xca/iti38-envelope";
import { createAndSignBulkDRRequests } from "../../saml/xca/iti39-envelope";
import { processXCPDResponse } from "./xcpd/process-xcpd-response";
import { processDQResponse } from "./xca/process-dq-response";
import { processDRResponse } from "./xca/process-dr-response";
import { sendSignedXCPDRequests, sendSignedDQRequests, sendSignedDRRequests } from "./saml-client";

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
    await axios.post(pdResponseUrl, result);
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
    await axios.post(dqResponseUrl, result);
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
      return processDRResponse({
        drResponse: response,
      });
    })
  );
  for (const result of results) {
    await axios.post(drResponseUrl, result);
  }
}
