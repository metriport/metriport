import { queryDocumentsAcrossHIEs as _queryDocumentsAcrossHIEs } from "../../../command/medical/document/document-query";
import { SourceQueryProgress } from "@metriport/core/domain/network-query";
import { documentQueryProgressToDTO } from "../../../routes/medical/dtos/networkDTO";

export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
  metadata,
  forceDownload,
  forceCommonwell,
  forceCarequality,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
  metadata?: Record<string, string> | undefined;
  forceDownload?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
}): Promise<SourceQueryProgress | undefined> {
  const progress = await _queryDocumentsAcrossHIEs({
    cxId,
    patientId,
    facilityId,
    forceDownload,
    cxDocumentRequestMetadata: metadata,
    forceCommonwell,
    forceCarequality,
  });

  return documentQueryProgressToDTO(progress);
}
