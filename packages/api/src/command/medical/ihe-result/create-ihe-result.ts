import { DocumentQueryResponse, PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { DocumentQueryResultModel } from "../../../models/medical/document-query-result";
import { PatientDiscoveryResultModel } from "../../../models/medical/patient-discovery-result";

export enum IHEResultType {
  DOCUMENT_QUERY = "document-query",
  PATIENT_DISCOVERY = "patient-discovery",
}

type IHEResult =
  | {
      type: IHEResultType.DOCUMENT_QUERY;
      response: DocumentQueryResponse;
    }
  | {
      type: IHEResultType.PATIENT_DISCOVERY;
      response: PatientDiscoveryResponse;
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
  }
}
