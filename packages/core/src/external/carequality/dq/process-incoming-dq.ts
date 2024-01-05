import {
  DocumentQueryRequestIncoming,
  DocumentQueryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { validateDQ } from "./validating-dq";
import { CODE_SYSTEM_REQUIRED_ERROR as DQ_CODE_SYSTEM_REQUIRED_ERROR } from "../shared";
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
    const documentIds = await validateDQ(payload);

    // construct response
    const response: DocumentQueryResponseOutgoing = {
      id: payload.id,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      extrinsicObjectXmls: documentIds,
    };

    return response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    switch (error.constructor) {
      case XDSUnknownPatientId:
        return constructDQErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "XDSUnknownPatientId",
          error.message
        );
      case XDSUnknownCommunity:
        return constructDQErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "XDSUnknownCommunity",
          error.message
        );
      case XDSMissingHomeCommunityId:
        return constructDQErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "XDSMissingHomeCommunityId",
          error.message
        );
      case XDSRegistryError:
        return constructDQErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "XDSRegistryError",
          error.message
        );
      default:
        return constructDQErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "Internal Server Error",
          "Unknown Error: Contact Metriport Support for assistance"
        );
    }
  }
}
