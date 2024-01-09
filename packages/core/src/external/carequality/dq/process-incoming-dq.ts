import {
  DocumentQueryRequestIncoming,
  DocumentQueryResponseOutgoing,
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
  payload: DocumentQueryRequestIncoming
): Promise<DocumentQueryResponseOutgoing> {
  try {
    // validate incoming request + look for patient and get all their documents from s3
    const documentContents = await validateDQ(payload);

    // construct response
    const response: DocumentQueryResponseOutgoing = {
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
