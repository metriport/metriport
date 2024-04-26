import axios from "axios";
import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  XCPDGateway,
} from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkXCPDRequests } from "../../saml/xcpd/iti55-envelope";
import { createAndSignBulkDQRequests } from "../../saml/xca/iti38-envelope";
import { createAndSignBulkDRRequests } from "../../saml/xca/iti39-envelope";
import { processXCPDResponse } from "./xcpd/process-xcpd-response";
import { processDQResponse } from "./xca/process-dq-response";
import { processDRResponse } from "./xca/process-dr-response";
import { sendSignedRequests } from "./saml-client";

export async function createSignSendProcessXCPDRequest({
  pdResponseUrl,
  xcpdRequest,
  publicCert,
  privateKey,
  privateKeyPassword,
  certChain,
  patientId,
  cxId,
}: {
  pdResponseUrl: string;
  xcpdRequest: OutboundPatientDiscoveryReq;
  publicCert: string;
  privateKey: string;
  privateKeyPassword: string;
  certChain: string;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkXCPDRequests(
    xcpdRequest,
    publicCert,
    privateKey,
    privateKeyPassword
  );
  const responses = await sendSignedRequests({
    signedRequests,
    certChain,
    publicCert,
    privateKey,
    privateKeyPassword,
    patientId,
    cxId,
  });
  const results: OutboundPatientDiscoveryResp[] = responses.map(response => {
    const gateway = response.gateway;
    if (!gateway) {
      throw new Error(`Gateway at index is undefined`);
    }
    return processXCPDResponse({
      xcpdResponse: response,
      outboundRequest: xcpdRequest,
      gateway: gateway as XCPDGateway,
      patientId,
      cxId,
    });
  });
  for (const result of results) {
    axios.post(pdResponseUrl, result);
  }
}

export async function createSignSendProcessDQRequests({
  dqResponseUrl,
  dqRequestsGatewayV2,
  publicCert,
  privateKey,
  privateKeyPassword,
  certChain,
  patientId,
  cxId,
}: {
  dqResponseUrl: string;
  dqRequestsGatewayV2: OutboundDocumentQueryReq[];
  publicCert: string;
  privateKey: string;
  privateKeyPassword: string;
  certChain: string;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkDQRequests({
    bulkBodyData: dqRequestsGatewayV2,
    publicCert,
    privateKey,
    privateKeyPassword,
  });
  const responses = await sendSignedRequests({
    signedRequests,
    certChain,
    publicCert,
    privateKey,
    privateKeyPassword,
    patientId,
    cxId,
  });
  const results = responses.map((response, index) => {
    const outboundRequest = dqRequestsGatewayV2[index];
    if (!outboundRequest) {
      throw new Error(`Outbound request at index ${index} is undefined.`);
    }
    const gateway = outboundRequest.gateway;
    if (!gateway) {
      throw new Error(`Gateway at index ${index} is undefined.`);
    }
    return processDQResponse({
      dqResponse: response,
      outboundRequest: outboundRequest,
      gateway,
    });
  });
  for (const result of results) {
    await axios.post(dqResponseUrl, result);
  }
}

export async function createSignSendProcessDRRequests({
  drResponseUrl,
  drRequestsGatewayV2,
  publicCert,
  privateKey,
  privateKeyPassword,
  certChain,
  patientId,
  cxId,
}: {
  drResponseUrl: string;
  drRequestsGatewayV2: OutboundDocumentRetrievalReq[];
  publicCert: string;
  privateKey: string;
  privateKeyPassword: string;
  certChain: string;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkDRRequests({
    bulkBodyData: drRequestsGatewayV2,
    publicCert,
    privateKey,
    privateKeyPassword,
  });
  const responses = await sendSignedRequests({
    signedRequests,
    certChain,
    publicCert,
    privateKey,
    privateKeyPassword,
    patientId,
    cxId,
  });
  const results = await Promise.all(
    responses.map(async (response, index) => {
      const outboundRequest = drRequestsGatewayV2[index];
      if (!outboundRequest) {
        throw new Error(`Outbound request at index ${index} is undefined.`);
      }
      const gateway = outboundRequest.gateway;
      if (!gateway) {
        throw new Error(`Gateway at index ${index} is undefined.`);
      }
      return processDRResponse({
        drResponse: response,
        outboundRequest: outboundRequest,
        gateway,
      });
    })
  );
  for (const result of results) {
    await axios.post(drResponseUrl, result);
  }
}
