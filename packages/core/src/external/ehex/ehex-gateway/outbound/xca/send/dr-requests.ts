import { OutboundDocumentRetrievalReq, XCAGateway } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { Config } from "../../../../../../util/config";
import { out } from "../../../../../../util/log";
import { safeStoreOutboundDrResponse, safeStoreOutboundDrRequest } from "../../../monitor/store";
import { sendSignedXmlMtom } from "../../../saml/saml-client";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { SignedDrRequest } from "../create/iti39-envelope";
import { MtomAttachments } from "../mtom/parser";

const { log } = out("Sending DR Requests");

export type DrSamlClientResponse = {
  gateway: XCAGateway;
  mtomResponse?: MtomAttachments;
  errorResponse?: string;
  outboundRequest: OutboundDocumentRetrievalReq;
};

export async function sendSignedDrRequest({
  request,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  request: SignedDrRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<DrSamlClientResponse> {
  try {
    const sendPromise = sendSignedXmlMtom({
      signedXml: request.signedRequest,
      url: request.gateway.url,
      samlCertsAndKeys,
      oid: request.outboundRequest.gateway.homeCommunityId,
      requestChunkId: request.outboundRequest.requestChunkId,
    });

    const [drResponse] = await Promise.all([sendPromise, storeDebugInfo(request)]);
    const { mtomParts, rawResponse } = drResponse;
    log(
      `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
        request.gateway.homeCommunityId
      }`
    );

    await safeStoreOutboundDrResponse({
      response: rawResponse,
      outboundRequest: request.outboundRequest,
      gateway: request.gateway,
      requestChunkId: request.outboundRequest.requestChunkId,
    });

    return {
      gateway: request.gateway,
      mtomResponse: mtomParts,
      outboundRequest: request.outboundRequest,
    };
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = "HTTP/SSL Failure Sending Signed DR SAML Request";
    log(
      `${msg}, requestId ${request.outboundRequest.id}, requestChunkId: ${
        request.outboundRequest.requestChunkId
      }, cxId: ${cxId}, patientId: ${patientId}, gateway: ${
        request.gateway.homeCommunityId
      }, error: ${errorToString(error)}`
    );
    if (error?.response?.data) {
      const errorDetails = Buffer.isBuffer(error?.response?.data)
        ? error.response.data.toString("utf-8")
        : JSON.stringify(error?.response?.data);
      log(
        `batchRequestId: ${request.outboundRequest.id}, requestChunkId: ${request.outboundRequest.requestChunkId}, error details: ${errorDetails}`
      );
    }

    const errorString: string = errorToString(error);
    return {
      gateway: request.gateway,
      outboundRequest: request.outboundRequest,
      errorResponse: errorString,
    };
  }
}

async function storeDebugInfo(request: SignedDrRequest): Promise<void> {
  const isDebugModeActive = Config.isDebugModeEnabled();
  if (!isDebugModeActive) return;
  return safeStoreOutboundDrRequest({
    requestXml: request.signedRequest,
    outboundRequest: request.outboundRequest,
  });
}
