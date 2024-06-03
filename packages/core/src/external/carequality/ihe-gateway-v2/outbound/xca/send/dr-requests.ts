import { XCAGateway, OutboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { getTrustedKeyStore, sendSignedXmlMtom } from "../../../saml/saml-client";
import { MtomAttachments } from "../mtom/parser";
import { BulkSignedDR } from "../create/iti39-envelope";
import { out } from "../../../../../../util/log";

const { log } = out("Sending DR Requests");

export type DrSamlClientResponse = {
  gateway: XCAGateway;
  mtomResponse?: MtomAttachments;
  errorResponse?: string;
  outboundRequest: OutboundDocumentRetrievalReq;
};

export async function sendSignedDRRequests({
  signedRequests,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  signedRequests: BulkSignedDR[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<DrSamlClientResponse[]> {
  const trustedKeyStore = await getTrustedKeyStore();
  const requestPromises = signedRequests.map(async (request, index) => {
    try {
      const mtomParts = await sendSignedXmlMtom({
        signedXml: request.signedRequest,
        url: request.gateway.url,
        samlCertsAndKeys,
        trustedKeyStore,
      });
      log(
        `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
          request.gateway.homeCommunityId
        }`
      );
      return {
        gateway: request.gateway,
        mtomResponse: mtomParts,
        outboundRequest: request.outboundRequest,
      };
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const msg = "Error sending signed DR SAML request";
      const errorString: string = errorToString(error);
      const errorDetails = error?.response?.data
        ? `, error details: ${JSON.stringify(error.response.data)}`
        : "";
      log(
        `${msg}, cxId: ${cxId}, patientId: ${patientId}, gateway: ${request.gateway.homeCommunityId}, error: ${errorString}${errorDetails}`
      );
      return {
        gateway: request.gateway,
        outboundRequest: request.outboundRequest,
        errorResponse: errorString,
      };
    }
  });

  return await Promise.all(requestPromises);
}
