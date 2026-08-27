import { OutboundPatientDiscoveryReq, XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { UNDEFINED_HTTP_STATUS_CODE } from "../../../../../../audit-log/types";
import { out } from "../../../../../../util";
import { Config } from "../../../../../../util/config";
import {
  safeStoreOutboundXcpdRequest,
  safeStoreOutboundXcpdResponses,
} from "../../../monitor/store";
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
}): Promise<{ response: XCPDSamlClientResponse; responseHttpStatusCode: number }> {
  try {
    const sendPromise = sendSignedXml({
      signedXml: request.signedRequest,
      url: request.gateway.url,
      samlCertsAndKeys,
      isDq: false,
    });

    const [xcpdResponse] = await Promise.all([sendPromise, storeDebugInfo(request)]);
    const { response, responseStatus } = xcpdResponse;
    log(
      `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
        request.gateway.oid
      }, statusCode: ${responseStatus}`
    );

    await safeStoreOutboundXcpdResponses({
      response,
      outboundRequest: request.outboundRequest,
      gateway: request.gateway,
    });

    return {
      response: {
        gateway: request.gateway,
        response,
        success: true,
        outboundRequest: request.outboundRequest,
      },
      responseHttpStatusCode: responseStatus,
    };
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = "HTTP/SSL Failure Sending Signed XCPD SAML Request";
    const errorDetails = error?.response?.data
      ? `error details: ${JSON.stringify(error.response.data)}`
      : "";
    const response = errorToString(error);
    const responseStatusCode = error.response?.status ?? UNDEFINED_HTTP_STATUS_CODE;
    log(
      `${msg}, requestId: ${request.outboundRequest.id}, cxId: ${cxId}, patientId: ${patientId}, ` +
        `gateway: ${request.gateway.oid}, error: ${error}, statusCode: ${responseStatusCode}, ${errorDetails}`
    );

    return {
      response: {
        gateway: request.gateway,
        outboundRequest: request.outboundRequest,
        response,
        success: false,
      },
      responseHttpStatusCode: responseStatusCode,
    };
  }
}

async function storeDebugInfo(request: SignedXcpdRequest): Promise<void> {
  const isDebugModeActive = Config.isDebugModeEnabled();
  if (!isDebugModeActive) return;

  return safeStoreOutboundXcpdRequest({
    requestXml: request.signedRequest,
    outboundRequest: request.outboundRequest,
  });
}
