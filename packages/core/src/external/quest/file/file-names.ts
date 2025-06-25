import { QuestRequester } from "../types";

export function buildRequestFileName({
  cxId,
  populationId,
}: {
  cxId: string;
  populationId: string;
}) {
  return `${cxId}_${populationId}`;
}

export function buildResponseFileName(requester: QuestRequester, patientId: string) {
  return `${requester.cxId}/${requester.facilityId}/${patientId}`;
}
