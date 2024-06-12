import { XCAGateway, OutboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { capture } from "../../../../../../util/notifications";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { getTrustedKeyStore, sendSignedXmlMtom } from "../../../saml/saml-client";
import { MtomAttachments } from "../mtom/parser";
import { BulkSignedDR } from "../create/iti39-envelope";
import { out } from "../../../../../../util/log";
import { storeDrResponses } from "../../../monitor/store";

const { log } = out("Sending DR Requests");
const context = "ihe-gateway-v2-dr-saml-client";

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
      const { mtomParts, rawResponse } = await sendSignedXmlMtom({
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
      await storeDrResponses({
        response: rawResponse,
        outboundRequest: request.outboundRequest,
        gateway: request.gateway,
      });
      return {
        gateway: request.gateway,
        mtomResponse: mtomParts,
        outboundRequest: request.outboundRequest,
      };
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const msg = "HTTP/SSL Failure Sending Signed DR SAML Request";
      log(
        `${msg}, cxId: ${cxId}, patientId: ${patientId}, gateway: ${request.gateway.homeCommunityId}, error: ${error}`
      );
      if (error?.response?.data) {
        const errorDetails = Buffer.isBuffer(error?.response?.data)
          ? error.response.data.toString("utf-8")
          : JSON.stringify(error?.response?.data);
        log(`error details: ${errorDetails}`);
      }

      const errorString: string = errorToString(error);
      const extra = {
        errorString,
        request,
        patientId,
        cxId,
      };
      capture.error(msg, {
        extra: {
          context,
          ...extra,
        },
      });
      return {
        gateway: request.gateway,
        outboundRequest: request.outboundRequest,
        errorResponse: errorString,
      };
    }
  });

  return await Promise.all(requestPromises);
}
