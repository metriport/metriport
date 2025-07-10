import { buildDayjs } from "@metriport/shared/common/date";
import { QuestRequester } from "../types";

export function buildRequestFileName({ populationId }: { populationId: string }) {
  return `METRIPORT_${populationId}_${buildDayjs().format("YYYYMMDD")}.txt`;
}

export function buildResponseFileName(requester: QuestRequester, patientId: string) {
  return `${requester.cxId}/${requester.facilityId}/${patientId}`;
}
