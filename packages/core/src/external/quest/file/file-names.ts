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
  dateString,
}: {
  cxId: string;
  patientId: string;
  dateString: string;
}) {
  return `quest/cxId=${cxId}/patientId=${patientId}/date=${dateString}.json`;
}
