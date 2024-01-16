import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  PatientDiscoveryRespFromExternalGW,
  DocumentQueryRespFromExternalGW,
  DocumentRetrievalRespFromExternalGW,
  isBaseErrorResponse,
  isDocumentQueryResponse,
  isDocumentRetrievalResponse,
} from "@metriport/ihe-gateway-sdk";
import { getIheResultStatus } from "../../ihe-result";
import { DefaultPayload } from "./shared";
import { createPatientDiscoveryResult } from "./create-patient-discovery-result";
import { createDocumentQueryResult } from "./create-document-query-result";
import { createDocumentRetrievalResult } from "./create-document-retrieval-result";

export enum IHEResultType {
  PATIENT_DISCOVERY_RESP_FROM_EXTERNAL_GW = "patient-discovery",
  DOCUMENT_QUERY_RESP_FROM_EXTERNAL_GW = "document-query",
  DOCUMENT_RETRIEVAL_RESP_FROM_EXTERNAL_GW = "document-retrieval",
}

type IHEResult =
  | {
      type: IHEResultType.DOCUMENT_QUERY_RESP_FROM_EXTERNAL_GW;
      response: DocumentQueryRespFromExternalGW;
    }
  | {
      type: IHEResultType.PATIENT_DISCOVERY_RESP_FROM_EXTERNAL_GW;
      response: PatientDiscoveryRespFromExternalGW;
    }
  | {
      type: IHEResultType.DOCUMENT_RETRIEVAL_RESP_FROM_EXTERNAL_GW;
      response: DocumentRetrievalRespFromExternalGW;
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
    case IHEResultType.PATIENT_DISCOVERY_RESP_FROM_EXTERNAL_GW: {
      status = getIheResultStatus({ patientMatch: response.patientMatch });
      await createPatientDiscoveryResult({ defaultPayload, status, response });
      return;
    }
    case IHEResultType.DOCUMENT_QUERY_RESP_FROM_EXTERNAL_GW: {
      await createDocumentQueryResult({ defaultPayload, status, response });
      return;
    }
    case IHEResultType.DOCUMENT_RETRIEVAL_RESP_FROM_EXTERNAL_GW: {
      await createDocumentRetrievalResult({ defaultPayload, status, response });
      return;
    }
  }
}
