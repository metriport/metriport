import {
  DocumentQueryReqFromExternalGW,
  DocumentQueryRespToExternalGW,
} from "@metriport/ihe-gateway-sdk";
import {
  XDSUnknownPatientId,
  XDSUnknownCommunity,
  XDSMissingHomeCommunityId,
  XDSRegistryError,
  validateDQ,
} from "./validating-dq";
import { CODE_SYSTEM_REQUIRED_ERROR as DQ_CODE_SYSTEM_REQUIRED_ERROR } from "../shared";

function constructErrorResponse(
  payload: DocumentQueryReqFromExternalGW,
  codingSystem: string,
  code: string,
  error: string
): DocumentQueryRespToExternalGW {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    switch (error.constructor) {
      case XDSUnknownPatientId:
        return constructErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "XDSUnknownPatientId",
          error.message
        );
      case XDSUnknownCommunity:
        return constructErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "XDSUnknownCommunity",
          error.message
        );
      case XDSMissingHomeCommunityId:
        return constructErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "XDSMissingHomeCommunityId",
          error.message
        );
      case XDSRegistryError:
        return constructErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "XDSRegistryError",
          error.message
        );
      default:
        return constructErrorResponse(
          payload,
          DQ_CODE_SYSTEM_REQUIRED_ERROR,
          "Internal Server Error",
          "Unknown Error: Contact Metriport Support for assistance"
        );
    }
  }
}
