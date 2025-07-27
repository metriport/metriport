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
