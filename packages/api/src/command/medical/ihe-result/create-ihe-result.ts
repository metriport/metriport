import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  PatientDiscoveryResponseIncoming,
  DocumentQueryResponseIncoming,
  DocumentRetrievalResponseIncoming,
  isBaseErrorResponse,
  isDocumentQueryResponse,
  isDocumentRetrievalResponse,
} from "@metriport/ihe-gateway-sdk";
import { getIheResultStatus } from "../../../domain/medical/ihe-result";
import { DocumentQueryResultModel } from "../../../models/medical/document-query-result";
import { DocumentRetrievalResultModel } from "../../../models/medical/document-retrieval-result";
import { PatientDiscoveryResultModel } from "../../../external/carequality/models/patient-discovery-result";

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

  const defaultPayload = {
    id: uuidv7(),
    requestId: id,
    patientId,
  };

  switch (type) {
    case IHEResultType.INCOMING_PATIENT_DISCOVERY_RESPONSE: {
      (status = getIheResultStatus({ patientMatch: response.patientMatch })),
        await PatientDiscoveryResultModel.create({
          ...defaultPayload,
          status,
          data: response,
        });
      return;
    }
    case IHEResultType.INCOMING_DOCUMENT_QUERY_RESPONSE: {
      await DocumentQueryResultModel.create({
        ...defaultPayload,
        status,
        data: response,
      });
      return;
    }
    case IHEResultType.INCOMING_DOCUMENT_RETRIEVAL_RESPONSE: {
      await DocumentRetrievalResultModel.create({
        ...defaultPayload,
        status,
        data: response,
      });
      return;
    }
  }
}
