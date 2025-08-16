import { buildDayjs } from "@metriport/shared/common/date";

export function buildRosterFileName() {
  const dateId = buildDayjs().format("YYYYMMDD");
  return `METRIPORT_${dateId}.txt`;
}

export function buildPatientLabConversionPrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}) {
  return `quest/cxId=${cxId}/patientId=${patientId}/date=`;
}

export function buildLatestConversionFileName(cxId: string, patientId: string) {
  return `quest/cxId=${cxId}/patientId=${patientId}/latest.json`;
}

export function buildLabConversionFileNameForDate({
  cxId,
  patientId,
  dateId,
}: {
  cxId: string;
  patientId: string;
  dateId: string;
}) {
  return `quest/cxId=${cxId}/patientId=${patientId}/date=${dateId}/conversion.json`;
}
