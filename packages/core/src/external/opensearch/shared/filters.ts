export function getPatientFilters(cxId: string, patientId: string) {
  return [{ term: { cxId } }, { term: { patientId } }];
}
