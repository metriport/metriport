import {
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { constructDRErrorResponse, IHEGatewayError, XDSRegistryError } from "../error";
import { buildDocumentReferences } from "./get-document-download-url";

export async function processInboundDocumentRetrieval(
  payload: InboundDocumentRetrievalReq
): Promise<InboundDocumentRetrievalResp> {
  try {
    const documents = await buildDocumentReferences(payload);

    const response: InboundDocumentRetrievalResp = {
      id: payload.id,
      patientId: payload.patientId,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      documentReference: documents,
    };
    return response;
  } catch (error) {
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
