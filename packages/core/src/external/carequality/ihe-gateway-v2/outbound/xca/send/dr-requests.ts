import { XCAGateway, OutboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../../../../util/error/shared";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { sendSignedXmlMtom } from "../../../saml/saml-client";
import { MtomAttachments } from "../mtom/parser";
import { SignedDrRequest } from "../create/iti39-envelope";
import { out } from "../../../../../../util/log";
import { storeDrResponse } from "../../../monitor/store";

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
    const { mtomParts, rawResponse } = await sendSignedXmlMtom({
      signedXml: request.signedRequest,
      url: request.gateway.url,
      samlCertsAndKeys,
      oid: request.outboundRequest.gateway.homeCommunityId,
      requestChunkId: request.outboundRequest.requestChunkId,
    });
    log(
      `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
        request.gateway.homeCommunityId
      }`
    );
    await storeDrResponse({
      response: rawResponse,
      outboundRequest: request.outboundRequest,
      gateway: request.gateway,
      requestChunkId: request.outboundRequest.requestChunkId,
    });
    console.log({ mtomParts: JSON.stringify(mtomParts) });
    return {
      gateway: request.gateway,
      mtomResponse: mtomParts,
      outboundRequest: request.outboundRequest,
    };
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = "HTTP/SSL Failure Sending Signed DR SAML Request";
    log(
      `${msg}, requestId ${request.outboundRequest.id}, requestChunkId: ${request.outboundRequest.requestChunkId}, cxId: ${cxId}, patientId: ${patientId}, gateway: ${request.gateway.homeCommunityId}, error: ${error}`
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
