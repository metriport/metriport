import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { DocumentQueryResponse } from "../../../domain/medical/document-query-result";
import { DocumentRetrievalResponse } from "../../../domain/medical/document-retrieval-result";
import { createPatientDiscoveryResult } from "../../../external/carequality/command/patient-discovery-result/create-patient-discovery-result";
import { DocumentQueryResultModel } from "../../../models/medical/document-query-result";
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
  };

  switch (type) {
    case IHEResultType.PATIENT_DISCOVERY: {
      await createPatientDiscoveryResult(response);
      return;
    }
    case IHEResultType.DOCUMENT_QUERY: {
      const hasError = operationOutcome?.issue && !response.documentReference?.length;

      await DocumentQueryResultModel.create({
        ...defaultPayload,
        status: hasError ? "failure" : "success",
        data: response,
      });
      return;
    }
    case IHEResultType.DOCUMENT_RETRIEVAL: {
      const hasError = operationOutcome?.issue && !response.documentReference?.length;

      await DocumentRetrievalResultModel.create({
        ...defaultPayload,
        status: hasError ? "failure" : "success",
        data: response,
      });
      return;
    }
  }
}
