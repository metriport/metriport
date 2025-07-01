import { XCAGateway, OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { capture } from "../../../../../../util/notifications";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { SamlClientResponse, sendSignedXml } from "../../../saml/saml-client";
import { SignedDqRequest } from "../create/iti38-envelope";
import { out } from "../../../../../../util/log";
import { storeDqResponse } from "../../../monitor/store";
import { shouldReportOutboundError } from "./shared";

const { log } = out("Sending DQ Requests");
const context = "ihe-gateway-v2-dq-saml-client";

export type DQSamlClientResponse = SamlClientResponse & {
  gateway: XCAGateway;
  outboundRequest: OutboundDocumentQueryReq;
};

export async function sendSignedDqRequest({
  request,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  request: SignedDqRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<DQSamlClientResponse> {
  try {
    const { response } = await sendSignedXml({
      signedXml: request.signedRequest,
      url: request.gateway.url,
      samlCertsAndKeys,
      isDq: true,
    });
    log(
      `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
        request.gateway.homeCommunityId
      }`
    );
    await storeDqResponse({
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
    const msg = `HTTP/SSL Failure Sending Signed DQ SAML Request ${index + 1}`;
    log(
      `${msg}, requestId: ${request.outboundRequest.id}, cxId: ${cxId}, patientId: ${patientId}, gateway: ${request.gateway.homeCommunityId}, error: ${error}`
    );
    if (error?.response?.data) {
      log(`error details: ${JSON.stringify(error?.response?.data)}`);
    }
    const errorString: string = errorToString(error);
    const isReportError = shouldReportOutboundError(error);
    if (isReportError) {
      const extra = {
        errorString,
        outboundRequest: request.outboundRequest,
        patientId,
        cxId,
      };
      capture.error(msg, { extra: { context, extra } });
    }
    return {
      gateway: request.gateway,
      outboundRequest: request.outboundRequest,
      response: errorString,
      success: false,
    };
  }
}
