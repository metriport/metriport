import { OutboundPatientDiscoveryReq, XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { out } from "../../../../../../util/log";
import { SamlClientResponse, sendSignedXml } from "../../../saml/saml-client";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { SignedXcpdRequest } from "../create/iti55-envelope";

const { log } = out("Sending XCPD Requests");

export type XCPDSamlClientResponse = SamlClientResponse & {
  gateway: XCPDGateway;
  outboundRequest: OutboundPatientDiscoveryReq;
};

export async function sendSignedXcpdRequest({
  request,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  request: SignedXcpdRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<XCPDSamlClientResponse> {
  try {
    const { response } = await sendSignedXml({
      signedXml: request.signedRequest,
      url: request.gateway.url,
      samlCertsAndKeys,
      isDq: false,
    });
    log(
      `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
        request.gateway.oid
      }`
    );
    // ENG-1048 Disable S3 storage for IHE raw requests/responses
    // await storeXcpdResponses({
    //   response,
    //   outboundRequest: request.outboundRequest,
    //   gateway: request.gateway,
    // });
    return {
      gateway: request.gateway,
      response,
      success: true,
      outboundRequest: request.outboundRequest,
    };
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = "HTTP/SSL Failure Sending Signed XCPD SAML Request";
    log(
      `${msg}, requestId: ${request.outboundRequest.id}, cxId: ${cxId}, patientId: ${patientId}, gateway: ${request.gateway.oid}, error: ${error}`
    );
    if (error?.response?.data) {
      log(`error details: ${JSON.stringify(error?.response?.data)}`);
    }

    const errorString: string = errorToString(error);
    return {
      gateway: request.gateway,
      outboundRequest: request.outboundRequest,
      response: errorString,
      success: false,
    };
  }
}
