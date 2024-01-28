import {
  DocumentRetrievalReqFromExternalGW,
  DocumentRetrievalRespToExternalGW,
} from "@metriport/ihe-gateway-sdk";
import { validateDRAndRetrievePresignedUrls } from "./validating-dr";
import { IHEGatewayError, constructDRErrorResponse, XDSRegistryError } from "../error";

export async function processIncomingRequest(
  payload: DocumentRetrievalReqFromExternalGW
): Promise<DocumentRetrievalRespToExternalGW> {
  try {
    // validate incoming request + look for patient and get all their documents from s3
    const documents = await validateDRAndRetrievePresignedUrls(payload);

    // construct response
    const response: DocumentRetrievalRespToExternalGW = {
      id: payload.id,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      documentReference: documents,
    };

    return response;
  } catch (error) {
    if (error instanceof IHEGatewayError) {
      return constructDRErrorResponse(payload, error);
    } else {
      return constructDRErrorResponse(payload, new XDSRegistryError("Internal Server Error"));
    }
  }
}
