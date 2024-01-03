import {
  DocumentQueryRequestIncoming,
  DocumentQueryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import {
  XDSUnknownPatientId,
  XDSUnknownCommunity,
  XDSMissingHomeCommunityId,
  XDSRegistryError,
  validateDQ,
} from "./validating-dq";

function constructErrorResponse(
  payload: DocumentQueryRequestIncoming,
  codingSystem: string,
  code: string,
  error: string
): DocumentQueryResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    operationOutcome: {
      resourceType: "OperationOutcome",
      id: payload.id,
      issue: [
        {
          severity: "error",
          code: "processing",
          details: {
            coding: [{ system: codingSystem, code: code }],
            text: error,
          },
        },
      ],
    },
  };
}

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
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.3",
          "XDSUnknownPatientId",
          error.message
        );
      case XDSUnknownCommunity:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.3",
          "XDSUnknownCommunity",
          error.message
        );
      case XDSMissingHomeCommunityId:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.3",
          "XDSMissingHomeCommunityId",
          error.message
        );
      case XDSRegistryError:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.3",
          "XDSRegistryError",
          error.message
        );
      default:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.3",
          "Internal Server Error",
          "Unknown Error: Contact Metriport Support for assistance"
        );
    }
  }
}
