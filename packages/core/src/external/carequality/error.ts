// error-response.ts
import {
  InboundDocumentQueryReq,
  InboundDocumentQueryResp,
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
  BaseErrorResponse,
} from "@metriport/ihe-gateway-sdk";
import { METRIPORT_HOME_COMMUNITY_ID, CODE_SYSTEM_ERROR } from "./shared";
import { MetriportError } from "../../util/error/metriport-error";
import status from "http-status";

export class IHEGatewayError extends MetriportError {
  constructor(
    message: string,
    cause?: unknown,
    public iheErrorCode?: string,
    statusCode: number = status.INTERNAL_SERVER_ERROR
  ) {
    super(message, cause);
    this.name = this.constructor.name;
    this.status = statusCode;
  }
}

export class PatientAddressRequestedError extends IHEGatewayError {
  constructor(message = "Address Line 1 is not defined", cause?: unknown) {
    super(message, cause, CODE_SYSTEM_ERROR, status.BAD_REQUEST);
    this.name = this.constructor.name;
    this.status = status.BAD_REQUEST;
  }
}

export class LivingSubjectAdministrativeGenderRequestedError extends IHEGatewayError {
  constructor(message = "Gender at Birth is not defined", cause?: unknown) {
    super(message, cause, CODE_SYSTEM_ERROR, status.BAD_REQUEST);
    this.name = this.constructor.name;
    this.status = status.BAD_REQUEST;
  }
}

export class XDSRegistryError extends IHEGatewayError {
  constructor(message = "Internal Server Error", cause?: unknown) {
    super(message, cause, CODE_SYSTEM_ERROR, status.INTERNAL_SERVER_ERROR);
    this.name = this.constructor.name;
  }
}

export class XDSUnknownPatientId extends IHEGatewayError {
  constructor(message = "Unknown Patient ID", cause?: unknown) {
    super(message, cause, CODE_SYSTEM_ERROR, status.BAD_REQUEST);
    this.name = this.constructor.name;
  }
}

export class XDSMissingHomeCommunityId extends IHEGatewayError {
  constructor(message = "Missing Home Community ID", cause?: unknown) {
    super(message, cause, CODE_SYSTEM_ERROR, status.BAD_REQUEST);
    this.name = this.constructor.name;
  }
}

export class XDSUnknownCommunity extends IHEGatewayError {
  constructor(message = "Unknown Community", cause?: unknown) {
    super(message, cause, CODE_SYSTEM_ERROR, status.BAD_REQUEST);
    this.name = this.constructor.name;
  }
}

function constructBaseErrorResponse(
  payload: InboundDocumentQueryReq | InboundDocumentRetrievalReq | InboundPatientDiscoveryReq,
  error?: IHEGatewayError
) {
  const baseResponse: BaseErrorResponse = {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
  };
  if (error) {
    baseResponse.operationOutcome = {
      resourceType: "OperationOutcome",
      id: payload.id,
      issue: [
        {
          severity: "error",
          code: "processing",
          details: {
            coding: [{ system: error.name, code: error.iheErrorCode ?? CODE_SYSTEM_ERROR }],
            text: error.message,
          },
        },
      ],
    };
  }
  return baseResponse;
}

export function constructDQErrorResponse(
  payload: InboundDocumentQueryReq,
  error: IHEGatewayError
): InboundDocumentQueryResp {
  return {
    ...constructBaseErrorResponse(payload, error),
  };
}

export function constructDRErrorResponse(
  payload: InboundDocumentRetrievalReq,
  error: IHEGatewayError
): InboundDocumentRetrievalResp {
  return {
    ...constructBaseErrorResponse(payload, error),
  };
}

export function constructPDNoMatchResponse(
  payload: InboundPatientDiscoveryReq
): InboundPatientDiscoveryResp {
  return {
    ...constructBaseErrorResponse(payload),
    patientMatch: false,
    gatewayHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}

export function constructPDErrorResponse(
  payload: InboundPatientDiscoveryReq,
  error: IHEGatewayError
): InboundPatientDiscoveryResp {
  return {
    ...constructBaseErrorResponse(payload, error),
    patientMatch: null,
    gatewayHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}
