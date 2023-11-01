import { toBaseDTO } from "./baseDTO";
import { DocRequest } from "../../../domain/medical/doc-request";
import { DocumentQueryProgress, Progress } from "../../../domain/medical/document-query";

export type RequestDTO = {
  cxId: string;
  patientId: string;
  facilityIds: string[];
  metadata: RequestMetadataDTO;
  documentQueryProgress?: DocumentQueryProgressDTO;
};

type RequestMetadataDTO = {
  data: { [key: string]: string };
};

type DocumentQueryProgressDTO = {
  download?: ProgressDTO;
  convert?: ProgressDTO;
  requestId?: string;
};

type ProgressDTO = {
  status: DocumentQueryStatusDTO;
  total?: number;
  successful?: number;
  errors?: number;
};

type DocumentQueryStatusDTO = "processing" | "completed" | "failed";

export function toDocumentQueryProgressDTO(model: DocumentQueryProgress): DocumentQueryProgressDTO {
  return {
    download: model.download ? toProgressDTO(model.download) : undefined,
    convert: model.convert ? toProgressDTO(model.convert) : undefined,
    requestId: model.requestId,
  };
}

function toProgressDTO(model: Progress): ProgressDTO {
  return {
    status: model.status,
    total: model.total,
    successful: model.successful,
    errors: model.errors,
  };
}

export function dtoFromModel(docRequest: DocRequest): RequestDTO {
  return {
    ...toBaseDTO(docRequest),
    cxId: docRequest.cxId,
    patientId: docRequest.patientId,
    facilityIds: docRequest.facilityIds,
    metadata: docRequest.metadata,
    documentQueryProgress: docRequest.documentQueryProgress
      ? toDocumentQueryProgressDTO(docRequest.documentQueryProgress)
      : undefined,
  };
}
