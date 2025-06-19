import { QuestRequester } from "../types";

export function buildRequestFileName({
  cxId,
  patientId,
  mappedPatientId,
}: {
  cxId: string;
  patientId: string;
  mappedPatientId: string;
}) {
  return `${cxId}_${patientId}_${mappedPatientId}`;
}

export function buildResponseFileName(requester: QuestRequester, patientId: string) {
  return `${requester.cxId}/${requester.facilityId}/${patientId}`;
}
