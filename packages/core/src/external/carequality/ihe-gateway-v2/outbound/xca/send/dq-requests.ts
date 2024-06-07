import { XCAGateway, OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { capture } from "../../../../../../util/notifications";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { getTrustedKeyStore, SamlClientResponse, sendSignedXml } from "../../../saml/saml-client";
import { BulkSignedDQ } from "../create/iti38-envelope";
import { out } from "../../../../../../util/log";
import { storeDqResponses } from "../../../monitor/store";

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
      const { response } = await sendSignedXml({
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
      await storeDqResponses({
        response,
        outboundRequest: request.outboundRequest,
        gateway: request.gateway,
      });
      return {
        gateway: request.gateway,
        response,
        success: true,
        outboundRequest: request.outboundRequest,
      };
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const msg = "HTTP/SSL Failure Sending Signed DQ SAML Request";
      log(
        `${msg}, cxId: ${cxId}, patientId: ${patientId}, gateway: ${request.gateway.homeCommunityId}, error: ${error}`
      );
      if (error?.response?.data) {
        log(`error details: ${JSON.stringify(error?.response?.data)}`);
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
          extra,
          error,
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
