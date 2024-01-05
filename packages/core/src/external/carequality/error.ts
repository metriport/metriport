// error-response.ts
import {
  DocumentQueryRequestIncoming,
  DocumentQueryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import {
  DocumentRetrievalRequestIncoming,
  DocumentRetrievalResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import {
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { METRIPORT_HOME_COMMUNITY_ID } from "./shared";

export class XDSUnknownPatientId extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSUnknownPatientId";
  }
}

export class XDSMissingHomeCommunityId extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSMissingHomeCommunityId";
  }
}

export class XDSRegistryError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSRegistryError";
  }
}

export class XDSUnknownCommunity extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSUnknownCommunity";
  }
}

export class PatientAddressRequestedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "PatientAddressRequestedError";
  }
}

export class LivingSubjectAdministrativeGenderRequestedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "LivingSubjectAdministrativeGenderRequestedError";
  }
}

export class InternalError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "InternalError";
  }
}

function constructBaseErrorResponse(
  payload:
    | DocumentQueryRequestIncoming
    | DocumentRetrievalRequestIncoming
    | PatientDiscoveryRequestIncoming,
  codingSystem: string,
  code: string,
  error: string
) {
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

export function constructDQErrorResponse(
  payload: DocumentQueryRequestIncoming,
  codingSystem: string,
  code: string,
  error: string
): DocumentQueryResponseOutgoing {
  return {
    ...constructBaseErrorResponse(payload, codingSystem, code, error),
  };
}

export function constructDRErrorResponse(
  payload: DocumentRetrievalRequestIncoming,
  codingSystem: string,
  code: string,
  error: string
): DocumentRetrievalResponseOutgoing {
  return {
    ...constructBaseErrorResponse(payload, codingSystem, code, error),
  };
}

export function constructPDNoMatchResponse(
  payload: PatientDiscoveryRequestIncoming
): PatientDiscoveryResponseOutgoing {
  return {
    ...constructBaseErrorResponse(payload, "processing", "no match found", "no match found"),
    patientMatch: false,
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}

export function constructPDErrorResponse(
  payload: PatientDiscoveryRequestIncoming,
  codingSystem: string,
  code: string,
  error: string
): PatientDiscoveryResponseOutgoing {
  return {
    ...constructBaseErrorResponse(payload, codingSystem, code, error),
    patientMatch: null,
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}
