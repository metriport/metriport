import { XCAGateway, OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { capture } from "../../../../../../util/notifications";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { getTrustedKeyStore, SamlClientResponse, sendSignedXml } from "../../../saml/saml-client";
import { BulkSignedDQ } from "../create/iti38-envelope";
import { out } from "../../../../../../util/log";

const { log } = out("Sending DQ Requests");
const context = "ihe-gateway-v2-dq-saml-client";

export type DQSamlClientResponse = SamlClientResponse & {
  gateway: XCAGateway;
  outboundRequest: OutboundDocumentQueryReq;
};

export async function sendSignedDQRequests({
  signedRequests,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  signedRequests: BulkSignedDQ[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<DQSamlClientResponse[]> {
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
      const msg = "HTTP/SSL Failure Sending Signed DQ SAML Request";
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

  return await Promise.all(requestPromises);
}
