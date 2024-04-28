import { XCPDGateway, OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { capture } from "../../../../../../util/notifications";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { getTrustedKeyStore, SamlClientResponse, sendSignedXml } from "../../../saml/saml-client";
import { BulkSignedXCPD } from "../create/iti55-envelope";

const context = "ihe-gateway-v2-xcpd-saml-client";

export type XCPDSamlClientResponse = SamlClientResponse & {
  gateway: XCPDGateway;
  outboundRequest: OutboundPatientDiscoveryReq;
};

export async function sendSignedXCPDRequests({
  signedRequests,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  signedRequests: BulkSignedXCPD[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<XCPDSamlClientResponse[]> {
  const trustedKeyStore = await getTrustedKeyStore();
  const requestPromises = signedRequests.map(async (request, index) => {
    try {
      const response = await sendSignedXml({
        signedXml: request.signedRequest,
        url: request.gateway.url,
        samlCertsAndKeys,
        trustedKeyStore,
      });
      console.log(
        `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
          request.gateway.oid
        }`
      );
      return {
        gateway: request.gateway,
        response,
        success: true,
        outboundRequest: request.outboundRequest,
      };
    } catch (error) {
      const msg = "HTTP/SSL Failure Sending Signed XCPD SAML Request";
      console.log(`${msg}, error: ${error}`);

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
  const processedResponses: XCPDSamlClientResponse[] = responses
    .map(result => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return undefined;
      }
    })
    .filter((response): response is XCPDSamlClientResponse => response !== undefined);

  return processedResponses;
}
