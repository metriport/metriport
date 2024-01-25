import {
  DocumentQueryReqFromExternalGW,
  DocumentQueryRespToExternalGW,
} from "@metriport/ihe-gateway-sdk";
import { validateDQ } from "./validating-dq";
import {
  XDSUnknownPatientId,
  XDSUnknownCommunity,
  XDSMissingHomeCommunityId,
  XDSRegistryError,
  constructDQErrorResponse,
} from "../error";

export async function processIncomingRequest(
  payload: DocumentQueryReqFromExternalGW
): Promise<DocumentQueryRespToExternalGW> {
  try {
    // validate incoming request + look for patient and get all their documents from s3
    const documentContents = await validateDQ(payload);

    // construct response
    const response: DocumentQueryRespToExternalGW = {
      id: payload.id,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      extrinsicObjectXmls: documentContents,
    };

    return response;
  } catch (error) {
    if (
      error instanceof XDSUnknownPatientId ||
      error instanceof XDSUnknownCommunity ||
      error instanceof XDSMissingHomeCommunityId ||
      error instanceof XDSRegistryError
    ) {
      return constructDQErrorResponse(payload, error);
    } else {
      return constructDQErrorResponse(payload, new XDSRegistryError());
    }
  }
}
