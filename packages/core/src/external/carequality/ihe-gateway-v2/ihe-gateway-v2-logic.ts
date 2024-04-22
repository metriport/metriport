import { createAndSignBulkXCPDRequests } from "../../saml/xcpd/iti55-envelope";
import { processXCPDResponse } from "./process-xcpd-response";
import { sendSignedRequests } from "./saml-client";
// import { MetriportError } from "../../../util/error/metriport-error";
import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";

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
      gateway,
      patientId,
      cxId,
    });
  });
  return results;
}
