export function buildRosterFileName() {
  return `master-roster.json`;
}

export function buildRequestFileName({
  populationId,
  dateString,
}: {
  populationId: string;
  dateString: string;
}) {
  return `METRIPORT_${populationId}_${dateString}.txt`;
}

export function buildResponseFileName({
  populationId,
  dateString,
}: {
  populationId: string;
  dateString: string;
}) {
  return `METRIPORT_${populationId}_${dateString}.txt`;
}

export function buildLatestConversionBundleFileName(cxId: string, patientId: string) {
  return `quest/cxId=${cxId}/patientId=${patientId}/latest.json`;
}

export function buildConversionBundleFileNameForDate({
  cxId,
  patientId,
  dateId,
}: {
  cxId: string;
  patientId: string;
  dateId: string;
}) {
  return `quest/cxId=${cxId}/patientId=${patientId}/date=${dateId}.json`;
}
