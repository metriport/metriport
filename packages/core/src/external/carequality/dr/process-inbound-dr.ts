import {
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { constructDRErrorResponse, IHEGatewayError, XDSRegistryError } from "../error";
import { buildDocumentReferences } from "./get-document-download-url";

export async function processInboundDr(
  payload: InboundDocumentRetrievalReq
): Promise<InboundDocumentRetrievalResp> {
  const { log } = out(`processInboundDr: ${payload.id}`);
  try {
    const documents = await buildDocumentReferences(payload);

    const response: InboundDocumentRetrievalResp = {
      id: payload.id,
      patientId: payload.patientId,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      documentReference: documents,
      signatureConfirmation: payload.signatureConfirmation,
    };
    return response;
  } catch (error) {
    log(`Error: ${errorToString(error)}`);
    if (error instanceof IHEGatewayError) {
      return constructDRErrorResponse(payload, error);
    } else {
      return constructDRErrorResponse(
        payload,
        new XDSRegistryError("Internal Server Error", error)
      );
    }
  }
}
