import { OutboundDocumentQueryReq, XCAGateway } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { Config } from "../../../../../../util/config";
import { out } from "../../../../../../util/log";
import { capture } from "../../../../../../util/notifications";
import { safeStoreOutboundDqResponse, safeStoreOutboundDqRequest } from "../../../monitor/store";
import { SamlClientResponse, sendSignedXml } from "../../../saml/saml-client";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { SignedDqRequest } from "../create/iti38-envelope";
import { shouldReportOutboundError } from "./shared";

const { log } = out("Sending DQ Requests");
const context = "ehex-gateway-dq-saml-client";

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
    const sendPromise = sendSignedXml({
      signedXml: request.signedRequest,
      url: request.gateway.url,
      samlCertsAndKeys,
      isDq: true,
    });

    const [dqResponse] = await Promise.all([sendPromise, storeDebugInfo(request)]);
    const { response } = dqResponse;
    log(
      `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
        request.gateway.homeCommunityId
      }`
    );

    await safeStoreOutboundDqResponse({
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
      `${msg}, requestId: ${
        request.outboundRequest.id
      }, cxId: ${cxId}, patientId: ${patientId}, gateway: ${
        request.gateway.homeCommunityId
      }, error: ${errorToString(error)}`
    );
    if (error?.response?.data) {
      log(`error details: ${JSON.stringify(error?.response?.data)}`);
    }
    const errorString: string = errorToString(error);
    const isReportError = shouldReportOutboundError(error);
    if (isReportError) {
      const extra = {
        cxId,
        patientId,
        errorString,
        outboundRequest: request.outboundRequest,
      };
      capture.error(msg, { extra: { context, extra, error: errorToString(error) } });
    }
    return {
      gateway: request.gateway,
      outboundRequest: request.outboundRequest,
      response: errorString,
      success: false,
    };
  }
}

async function storeDebugInfo(request: SignedDqRequest): Promise<void> {
  const isDebugModeActive = Config.isDebugModeEnabled();
  if (!isDebugModeActive) return;

  return safeStoreOutboundDqRequest({
    requestXml: request.signedRequest,
    outboundRequest: request.outboundRequest,
  });
}
