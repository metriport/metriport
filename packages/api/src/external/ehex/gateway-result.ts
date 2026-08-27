import {
  isSuccessfulOutboundDocRetrievalResponse,
  OutboundDocumentRetrievalResp,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import {
  isSuccessfulOutboundDocQueryResponse,
  OutboundDocumentQueryResp,
} from "@metriport/ihe-gateway-sdk/models/document-query/document-query-responses";
import { uuidv7 } from "@metriport/shared/util";
import { createOutboundDocumentQueryResp } from "./command/outbound-resp/create-outbound-document-query-resp";
import { createOutboundDocumentRetrievalResp } from "./command/outbound-resp/create-outbound-document-retrieval-resp";
import {
  EhexOutboundDocumentQueryResp,
  EhexOutboundDocumentRetrievalResp,
} from "./models/interfaces";

export type IHEResultStatus = "success" | "failure";

export type OutboundEhexPatientDiscoveryRespParam = {
  patientId: string;
  cxId: string;
  requestId: string;
  results: OutboundPatientDiscoveryResp[];
};

export type OutboundEhexDocQueryRespParam = {
  patientId: string;
  cxId: string;
  requestId: string;
  response: OutboundDocumentQueryResp[];
  forceDownload: boolean;
};

export type OutboundEhexDocRetrievalRespParam = {
  patientId: string;
  cxId: string;
  requestId: string;
  results: OutboundDocumentRetrievalResp[];
  forceDownload: boolean;
};

export function getPDResultStatus({
  patientMatch,
}: {
  patientMatch?: boolean | null;
}): IHEResultStatus {
  return patientMatch ? "success" : "failure";
}

export async function processAndStoreOutboundDqResponse(
  response: OutboundDocumentQueryResp,
  patientId: string
): Promise<EhexOutboundDocumentQueryResp> {
  const status = getDqResultStatus(response);

  const dqResp = await createOutboundDocumentQueryResp({
    id: uuidv7(),
    requestId: response.id,
    patientId,
    status,
    response,
  });
  return dqResp;
}

export async function processAndStoreOutboundDrResponse(
  response: OutboundDocumentRetrievalResp,
  patientId: string
): Promise<EhexOutboundDocumentRetrievalResp> {
  const status = getDrResultStatus(response);

  const drResp = await createOutboundDocumentRetrievalResp({
    id: uuidv7(),
    requestId: response.originalRequestId ?? response.id,
    patientId,
    status,
    response,
  });
  return drResp;
}

function getDqResultStatus(response: OutboundDocumentQueryResp): IHEResultStatus {
  return isSuccessfulOutboundDocQueryResponse(response)
    ? getDocumentResultStatus({
        docRefLength: response.documentReference?.length,
      })
    : "failure";
}

function getDocumentResultStatus({ docRefLength }: { docRefLength?: number }): IHEResultStatus {
  if (docRefLength !== undefined && docRefLength >= 1) return "success";
  return "failure";
}

export function getDrResultStatus(response: OutboundDocumentRetrievalResp): IHEResultStatus {
  return isSuccessfulOutboundDocRetrievalResponse(response)
    ? getDocumentResultStatus({
        docRefLength: response.documentReference?.length,
      })
    : "failure";
}

export function getDRResultStatus(
  params: Parameters<typeof getDocumentResultStatus>[0]
): IHEResultStatus {
  return getDocumentResultStatus(params);
}
