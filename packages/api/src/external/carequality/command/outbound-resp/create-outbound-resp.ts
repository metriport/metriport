import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  OutboundPatientDiscoveryResp,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  isBaseErrorResponse,
  isOutboundDocumentQueryResponse,
  isOutboundDocumentRetrievalResponse,
} from "@metriport/ihe-gateway-sdk";
import { getIheResultStatus } from "../../ihe-result";
import { DefaultPayload } from "./shared";
import { createOutboundPatientDiscoveryResp } from "./create-outbound-patient-discovery-resp";
import { createOutboundDocumentQueryResp } from "./create-outbound-document-query-resp";
import { createOutboundDocumentRetrievalResp } from "./create-outbound-document-retrieval-resp";

export enum OutboundRespType {
  OUTBOUND_PATIENT_DISCOVERY_RESP = "patient-discovery",
  OUTBOUND_DOCUMENT_QUERY_RESP = "document-query",
  OUTBOUND_DOCUMENT_RETRIEVAL_RESP = "document-retrieval",
}

type OutboundResp =
  | {
      type: OutboundRespType.OUTBOUND_DOCUMENT_QUERY_RESP;
      response: OutboundDocumentQueryResp;
    }
  | {
      type: OutboundRespType.OUTBOUND_PATIENT_DISCOVERY_RESP;
      response: OutboundPatientDiscoveryResp;
    }
  | {
      type: OutboundRespType.OUTBOUND_DOCUMENT_RETRIEVAL_RESP;
      response: OutboundDocumentRetrievalResp;
    };

export async function handleOutboundResponse({ type, response }: OutboundResp): Promise<void> {
  const { id, patientId } = response;
  let status = "failure";

  // Check if response is a BaseErrorResponse
  if (isOutboundDocumentQueryResponse(response) || isOutboundDocumentRetrievalResponse(response)) {
    status = getIheResultStatus({
      docRefLength: response.documentReference?.length,
    });
  } else if (isBaseErrorResponse(response)) {
    status = "failure";
  }

  const defaultPayload: DefaultPayload = {
    id: uuidv7(),
    requestId: id,
    patientId: patientId ? patientId : "",
  };

  switch (type) {
    case OutboundRespType.OUTBOUND_PATIENT_DISCOVERY_RESP: {
      status = getIheResultStatus({ patientMatch: response.patientMatch });
      await createOutboundPatientDiscoveryResp({ defaultPayload, status, response });
      return;
    }
    case OutboundRespType.OUTBOUND_DOCUMENT_QUERY_RESP: {
      await createOutboundDocumentQueryResp({ defaultPayload, status, response });
      return;
    }
    case OutboundRespType.OUTBOUND_DOCUMENT_RETRIEVAL_RESP: {
      await createOutboundDocumentRetrievalResp({ defaultPayload, status, response });
      return;
    }
  }
}
