import { DocumentQueryStatus, DocumentQueryProgress } from "@metriport/core/domain/document-query";

export type NetworkSourceStatusDTO = {
  type: "hie" | "pharmacy" | "laboratory";
  source?: string;
  status: DocumentQueryStatus;
};

export function documentQueryProgressToDTO(
  progress?: DocumentQueryProgress
): NetworkSourceStatusDTO[] {
  if (!progress) return [];
  // TODO: convert progress to DTO
  return [];
}
