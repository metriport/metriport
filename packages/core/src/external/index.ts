export enum MedicalDataSource {
  ALL = "ALL",
  COMMONWELL = "COMMONWELL",
  CAREQUALITY = "CAREQUALITY",
}

export function isMedicalDataSource(s?: string | null): s is MedicalDataSource {
  if (!s) return false;
  const list = Object.values(MedicalDataSource) as string[];
  return list.includes(s);
}
