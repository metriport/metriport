import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { constructDQErrorResponse, IHEGatewayError, XDSRegistryError } from "../error";
import { findDocumentReferences } from "./find-document-reference";

export async function processInboundDocumentQuery(
  payload: InboundDocumentQueryReq
): Promise<InboundDocumentQueryResp> {
  try {
    const documentContents = await findDocumentReferences(payload);

    const response: InboundDocumentQueryResp = {
      id: payload.id,
      patientId: payload.patientId,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      extrinsicObjectXmls: documentContents,
    };
    return response;
  } catch (error) {
    if (error instanceof IHEGatewayError) {
      return constructDQErrorResponse(payload, error);
    } else {
      return constructDQErrorResponse(
        payload,
        new XDSRegistryError("Internal Server Error", error)
      );
    }
  }
}
