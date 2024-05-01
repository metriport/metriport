import { XCAGateway, OutboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { capture } from "../../../../../../util/notifications";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { getTrustedKeyStore, SamlClientResponse, sendSignedXml } from "../../../saml/saml-client";
import { BulkSignedDR } from "../create/iti39-envelope";
import { out } from "../../../../../../util/log";

const { log } = out("Sending DR Requests");
const context = "ihe-gateway-v2-dr-saml-client";

export type DRSamlClientResponse = SamlClientResponse & {
  gateway: XCAGateway;
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
}): Promise<DRSamlClientResponse[]> {
  const trustedKeyStore = await getTrustedKeyStore();
  const requestPromises = signedRequests.map(async (request, index) => {
    try {
      const response = await sendSignedXml({
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
        response,
        success: true,
        outboundRequest: request.outboundRequest,
      };
    } catch (error) {
      const msg = "HTTP/SSL Failure Sending Signed DR SAML Request";
      log(`${msg}, error: ${error}`);

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
          extra,
        },
      });
      return {
        gateway: request.gateway,
        outboundRequest: request.outboundRequest,
        response: errorString,
        success: false,
      };
    }
  });

  const responses = await Promise.allSettled(requestPromises);
  const processedResponses = responses
    .map(result => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return undefined;
      }
    })
    .filter((response): response is DRSamlClientResponse => response !== undefined);

  return processedResponses;
}
