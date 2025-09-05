import { buildDayjs } from "@metriport/shared/common/date";

export function buildTrainInputPrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  const date = buildDayjs().format("[year=]yyyy/[month=]mm/[day=]dd/[hour=]HH/[min=]mm");
  return `train/in/${date}/cx=${cxId}/pt=${patientId}`;
}
