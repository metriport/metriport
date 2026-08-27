import {
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { buildDayjs } from "@metriport/shared/common/date";
import { constructDRErrorResponse, IHEGatewayError, XDSRegistryError } from "../error";
import { buildDocumentReferences } from "./get-document-download-url";

export async function processInboundDr(
  payload: InboundDocumentRetrievalReq
): Promise<InboundDocumentRetrievalResp> {
  try {
    const documents = await buildDocumentReferences(payload);

    const response: InboundDocumentRetrievalResp = {
      id: payload.id,
      cxId: payload.cxId,
      patientId: payload.patientId,
      timestamp: payload.timestamp,
      responseTimestamp: buildDayjs().toISOString(),
      documentReference: documents,
      signatureConfirmation: payload.signatureConfirmation,
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
