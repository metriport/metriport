import { BadRequestError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";

// TODO ENG-954 review this, likely don't need to have this structure
export function buildTrainInputPrefix({
  cxId,
  patientId,
  date = buildDayjs(),
}: {
  cxId: string;
  patientId: string;
  date?: dayjs.Dayjs;
}): string {
  if (!cxId || !cxId.trim()) {
    throw new BadRequestError("cxId is required");
  }
  if (!patientId || !patientId.trim()) {
    throw new BadRequestError("patientId is required");
  }
  const datePart = date.format("[year=]YYYY/[month=]MM/[day=]DD/[hour=]HH/[min=]mm");
  return `train/in/${datePart}/cx=${cxId}/pt=${patientId}`;
}
