import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  PatientDiscoveryResponseIncoming,
  DocumentQueryResponseIncoming,
  DocumentRetrievalResponseIncoming,
  isBaseErrorResponse,
  isDocumentQueryResponse,
  isDocumentRetrievalResponse,
} from "@metriport/ihe-gateway-sdk";
import { getIheResultStatus } from "../../domain/ihe-result";
import { DefaultPayload } from "./shared";
import { createPatientDiscoveryResult } from "./create-patient-discovery-result";
import { createDocumentQueryResult } from "./create-document-query-result";
import { createDocumentRetrievalResult } from "./create-document-retrieval-result";

export enum IHEResultType {
  INCOMING_PATIENT_DISCOVERY_RESPONSE = "patient-discovery",
  INCOMING_DOCUMENT_QUERY_RESPONSE = "document-query",
  INCOMING_DOCUMENT_RETRIEVAL_RESPONSE = "document-retrieval",
}

type IHEResult =
  | {
      type: IHEResultType.INCOMING_DOCUMENT_QUERY_RESPONSE;
      response: DocumentQueryResponseIncoming;
    }
  | {
      type: IHEResultType.INCOMING_PATIENT_DISCOVERY_RESPONSE;
      response: PatientDiscoveryResponseIncoming;
    }
  | {
      type: IHEResultType.INCOMING_DOCUMENT_RETRIEVAL_RESPONSE;
      response: DocumentRetrievalResponseIncoming;
    };

export async function handleIHEResponse({ type, response }: IHEResult): Promise<void> {
  const { id, patientId } = response;
  let status = "failure";

  // Check if response is a BaseErrorResponse
  if (isBaseErrorResponse(response)) {
    status = "failure";
  } else if (isDocumentQueryResponse(response) || isDocumentRetrievalResponse(response)) {
    status = getIheResultStatus({
      docRefLength: response.documentReference?.length,
    });
  }

  const defaultPayload: DefaultPayload = {
    id: uuidv7(),
    requestId: id,
    patientId: patientId ? patientId : "",
  };

  switch (type) {
    case IHEResultType.INCOMING_PATIENT_DISCOVERY_RESPONSE: {
      status = getIheResultStatus({ patientMatch: response.patientMatch });
      await createPatientDiscoveryResult({ defaultPayload, status, response });
      return;
    }
    case IHEResultType.INCOMING_DOCUMENT_QUERY_RESPONSE: {
      await createDocumentQueryResult({ defaultPayload, status, response });
      return;
    }
    case IHEResultType.INCOMING_DOCUMENT_RETRIEVAL_RESPONSE: {
      await createDocumentRetrievalResult({ defaultPayload, status, response });
      return;
    }
  }
}
