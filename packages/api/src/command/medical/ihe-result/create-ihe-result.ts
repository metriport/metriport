import {
  DocumentQueryResponse,
  PatientDiscoveryResponse,
  DocumentRetrievalResponse,
} from "@metriport/ihe-gateway-sdk";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { DocumentQueryResultModel } from "../../../models/medical/document-query-result";
import { PatientDiscoveryResultModel } from "../../../models/medical/patient-discovery-result";
import { DocumentRetrievalResultModel } from "../../../models/medical/document-retrieval-result";

export enum IHEResultType {
  PATIENT_DISCOVERY = "patient-discovery",
  DOCUMENT_QUERY = "document-query",
  DOCUMENT_RETRIEVAL = "document-retrieval",
}

type IHEResult =
  | {
      type: IHEResultType.DOCUMENT_QUERY;
      response: DocumentQueryResponse;
    }
  | {
      type: IHEResultType.PATIENT_DISCOVERY;
      response: PatientDiscoveryResponse;
    }
  | {
      type: IHEResultType.DOCUMENT_RETRIEVAL;
      response: DocumentRetrievalResponse;
    };

export async function handleIHEResponse({ type, response }: IHEResult): Promise<void> {
  const { id, patientId, operationOutcome } = response;

  const defaultPayload = {
    id: uuidv7(),
    requestId: id,
    patientId,
    status: operationOutcome?.issue ? "failure" : "success",
  };

  switch (type) {
    case IHEResultType.PATIENT_DISCOVERY:
      await PatientDiscoveryResultModel.create({
        ...defaultPayload,
        data: response,
      });
      break;
    case IHEResultType.DOCUMENT_QUERY:
      await DocumentQueryResultModel.create({
        ...defaultPayload,
        data: response,
      });
      break;
    case IHEResultType.DOCUMENT_RETRIEVAL:
      await DocumentRetrievalResultModel.create({
        ...defaultPayload,
        data: response,
      });
      break;
  }
}
