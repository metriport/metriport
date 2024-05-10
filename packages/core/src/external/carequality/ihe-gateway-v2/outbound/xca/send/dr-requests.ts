import { XCAGateway, OutboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { capture } from "../../../../../../util/notifications";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import {
  getTrustedKeyStore,
  SamlClientResponse,
  sendSignedXmlMTOM,
} from "../../../saml/saml-client";
import { BulkSignedDR } from "../create/iti39-envelope";
import { out } from "../../../../../../util/log";

const { log } = out("Sending DR Requests");
const context = "ihe-gateway-v2-dr-saml-client";

export type DRSamlClientResponse = SamlClientResponse & {
  gateway: XCAGateway;
  outboundRequest: OutboundDocumentRetrievalReq;
  contentType: string | undefined;
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
      const { response, contentType } = await sendSignedXmlMTOM({
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
        contentType,
      };
    } catch (error) {
      const msg = "HTTP/SSL Failure Sending Signed DR SAML Request";
      log(`${msg}, error: ${error}`);
      console.log(error);

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
        contentType: undefined,
      };
    }
  });

  return await Promise.all(requestPromises);
}
