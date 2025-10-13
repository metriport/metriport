import { Patient } from "@metriport/core/domain/patient";
import { queryDocumentsAcrossHIEs as _queryDocumentsAcrossHIEs } from "../../../command/medical/document/document-query";
import { SourceQueryProgress } from "@metriport/core/domain/network-query";
import { documentQueryProgressToDTO } from "../../../routes/medical/dtos/networkDTO";

export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
  metadata,
  override,
  forceCommonwell,
  forceCarequality,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
  metadata?: Record<string, string> | undefined;
  override?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
}): Promise<SourceQueryProgress[]> {
  const progress = await _queryDocumentsAcrossHIEs({
    cxId,
    patientId,
    facilityId,
    forceDownload: override,
    cxDocumentRequestMetadata: metadata,
    forceCommonwell,
    forceCarequality,
  });

  const sourceQueryProgress = documentQueryProgressToDTO(progress);
  return sourceQueryProgress ? [sourceQueryProgress] : [];
}

export async function getHieQueryStatus({
  patient,
}: {
  patient: Patient;
}): Promise<SourceQueryProgress | undefined> {
  const { documentQueryProgress } = patient.data;
  if (!documentQueryProgress) return undefined;
  const sourceQueryProgress = documentQueryProgressToDTO(documentQueryProgress);
  return sourceQueryProgress;
}
