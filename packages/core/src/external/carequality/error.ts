// error-response.ts
import {
  DocumentQueryRequestIncoming,
  DocumentQueryResponseOutgoing,
  DocumentRetrievalRequestIncoming,
  DocumentRetrievalResponseOutgoing,
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
  BaseErrorResponse,
} from "@metriport/ihe-gateway-sdk";
import { METRIPORT_HOME_COMMUNITY_ID, CODE_SYSTEM_ERROR } from "./shared";
import { MetriportError } from "../../util/error/metriport-error";
import status from "http-status";

export class IHEGatewayError extends MetriportError {
  constructor(
    message: string,
    public iheErrorCode: string,
    statusCode: number = status.BAD_REQUEST
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = statusCode;
  }
}

export class PatientAddressRequestedError extends IHEGatewayError {
  constructor(message = "Address Line 1 is not defined") {
    super(message, CODE_SYSTEM_ERROR);
    this.name = this.constructor.name;
  }
}

export class LivingSubjectAdministrativeGenderRequestedError extends IHEGatewayError {
  constructor(message = "Gender at Birth is not defined") {
    super(message, CODE_SYSTEM_ERROR);
    this.name = this.constructor.name;
  }
}

export class XDSRegistryError extends IHEGatewayError {
  constructor(message = "Internal Server Error") {
    super(message, CODE_SYSTEM_ERROR, status.INTERNAL_SERVER_ERROR);
    this.name = this.constructor.name;
  }
}

export class XDSUnknownPatientId extends IHEGatewayError {
  constructor(message = "Unknown Patient ID") {
    super(message, CODE_SYSTEM_ERROR, status.BAD_REQUEST);
    this.name = this.constructor.name;
  }
}

export class XDSMissingHomeCommunityId extends IHEGatewayError {
  constructor(message = "Missing Home Community ID") {
    super(message, CODE_SYSTEM_ERROR, status.BAD_REQUEST);
    this.name = this.constructor.name;
  }
}

export class XDSUnknownCommunity extends IHEGatewayError {
  constructor(message = "Unknown Community") {
    super(message, CODE_SYSTEM_ERROR, status.BAD_REQUEST);
    this.name = this.constructor.name;
  }
}

function constructBaseErrorResponse(
  payload:
    | DocumentQueryRequestIncoming
    | DocumentRetrievalRequestIncoming
    | PatientDiscoveryRequestIncoming,
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
            coding: [{ system: error.name, code: error.iheErrorCode }],
            text: error.message,
          },
        },
      ],
    };
  }
  return baseResponse;
}

export function constructDQErrorResponse(
  payload: DocumentQueryRequestIncoming,
  error: IHEGatewayError
): DocumentQueryResponseOutgoing {
  return {
    ...constructBaseErrorResponse(payload, error),
  };
}

export function constructDRErrorResponse(
  payload: DocumentRetrievalRequestIncoming,
  error: IHEGatewayError
): DocumentRetrievalResponseOutgoing {
  return {
    ...constructBaseErrorResponse(payload, error),
  };
}

export function constructPDNoMatchResponse(
  payload: PatientDiscoveryRequestIncoming
): PatientDiscoveryResponseOutgoing {
  return {
    ...constructBaseErrorResponse(payload),
    patientMatch: false,
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}

export function constructPDErrorResponse(
  payload: PatientDiscoveryRequestIncoming,
  error: IHEGatewayError
): PatientDiscoveryResponseOutgoing {
  return {
    ...constructBaseErrorResponse(payload, error),
    patientMatch: null,
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}
