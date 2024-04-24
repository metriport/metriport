import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
  OutboundDocumentQueryResp,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
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
  xcpdRequest,
  publicCert,
  privateKey,
  privateKeyPassword,
  certChain,
  patientId,
  cxId,
}: {
  xcpdRequest: OutboundPatientDiscoveryReq;
  publicCert: string;
  privateKey: string;
  privateKeyPassword: string;
  certChain: string;
  patientId: string;
  cxId: string;
}): Promise<OutboundPatientDiscoveryResp[]> {
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
  return results;
}

export async function createSignSendProcessDQRequests({
  dqRequestsGatewayV2,
  publicCert,
  privateKey,
  privateKeyPassword,
  certChain,
  patientId,
  cxId,
}: {
  dqRequestsGatewayV2: OutboundDocumentQueryReq[];
  publicCert: string;
  privateKey: string;
  privateKeyPassword: string;
  certChain: string;
  patientId: string;
  cxId: string;
}): Promise<OutboundDocumentQueryResp[]> {
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
  return results;
}

export async function createSignSendProcessDRRequests({
  drRequestsGatewayV2,
  publicCert,
  privateKey,
  privateKeyPassword,
  certChain,
  patientId,
  cxId,
}: {
  drRequestsGatewayV2: OutboundDocumentRetrievalReq[];
  publicCert: string;
  privateKey: string;
  privateKeyPassword: string;
  certChain: string;
  patientId: string;
  cxId: string;
}): Promise<OutboundDocumentRetrievalResp[]> {
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
  return results;
}
