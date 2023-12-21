import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { PatientDiscoveryResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { DocumentQueryResponse } from "../../../domain/medical/document-query-result";
import { DocumentRetrievalResponse } from "../../../domain/medical/document-retrieval-result";
import { getIheResultStatus } from "../../../domain/medical/ihe-result";
import { createPatientDiscoveryResult } from "../../../external/carequality/command/patient-discovery-result/create-patient-discovery-result";
import { DocumentQueryResultModel } from "../../../models/medical/document-query-result";
import { DocumentRetrievalResultModel } from "../../../models/medical/document-retrieval-result";

export enum IHEResultType {
  PATIENT_DISCOVERY_RESPONSE_INCOMING = "patient-discovery",
  DOCUMENT_QUERY_RESPONSE_INCOMING = "document-query",
  DOCUMENT_RETRIEVAL_RESPONSE_INCOMING = "document-retrieval",
}

type IHEResult =
  | {
      type: IHEResultType.DOCUMENT_QUERY_RESPONSE_INCOMING;
      response: DocumentQueryResponse;
    }
  | {
      type: IHEResultType.PATIENT_DISCOVERY_RESPONSE_INCOMING;
      response: PatientDiscoveryResponseIncoming;
    }
  | {
      type: IHEResultType.DOCUMENT_RETRIEVAL_RESPONSE_INCOMING;
      response: DocumentRetrievalResponse;
    };

export async function handleIHEResponse({ type, response }: IHEResult): Promise<void> {
  const { id, patientId, operationOutcome } = response;

  const defaultPayload = {
    id: uuidv7(),
    requestId: id,
    patientId,
  };

  switch (type) {
    case IHEResultType.PATIENT_DISCOVERY_RESPONSE_INCOMING: {
      await createPatientDiscoveryResult(response);
      return;
    }
    case IHEResultType.DOCUMENT_QUERY_RESPONSE_INCOMING: {
      await DocumentQueryResultModel.create({
        ...defaultPayload,
        status: getIheResultStatus({
          operationOutcome,
          docRefLength: response.documentReference?.length,
        }),
        data: response,
      });
      return;
    }
    case IHEResultType.DOCUMENT_RETRIEVAL_RESPONSE_INCOMING: {
      await DocumentRetrievalResultModel.create({
        ...defaultPayload,
        status: getIheResultStatus({
          operationOutcome,
          docRefLength: response.documentReference?.length,
        }),
        data: response,
      });
      return;
    }
  }
}
