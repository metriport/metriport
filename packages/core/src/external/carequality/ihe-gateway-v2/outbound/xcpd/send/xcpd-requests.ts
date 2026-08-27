import { OutboundPatientDiscoveryReq, XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { out } from "../../../../../../util";
import { errorToString } from "../../../../../../util/error/shared";
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
  let xcpdResponse: XCPDSamlClientResponse | undefined;

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

    xcpdResponse = {
      gateway: request.gateway,
      response,
      success: true,
      outboundRequest: request.outboundRequest,
    };
    return xcpdResponse;
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = "HTTP/SSL Failure Sending Signed XCPD SAML Request";
    const errorDetails = error?.response?.data
      ? `error details: ${JSON.stringify(error.response?.data)}`
      : "";
    log(
      `${msg}, requestId: ${request.outboundRequest.id}, cxId: ${cxId}, patientId: ${patientId}, ` +
        `gateway: ${request.gateway.oid}, error: ${error}, ${errorDetails}`
    );

    const errorString: string = errorToString(error);
    xcpdResponse = {
      gateway: request.gateway,
      outboundRequest: request.outboundRequest,
      response: errorString,
      success: false,
    };
    return xcpdResponse;
  }
}
