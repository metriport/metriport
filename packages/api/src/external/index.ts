export enum MedicalDataSource {
  COMMONWELL = "COMMONWELL",
  CAREQUALITY = "CAREQUALITY",
}

export function isMedicalDataSource(s?: string | null): s is MedicalDataSource {
  if (!s) return false;
  const list = Object.values(MedicalDataSource) as string[];
  return list.includes(s);
}

export const HL7OID = "2.16.840.1.113883";

export const MedicalDataSourceOid: Record<MedicalDataSource, string> = {
  [MedicalDataSource.COMMONWELL]: `${HL7OID}.3.3330`,
  [MedicalDataSource.CAREQUALITY]: `${HL7OID}.3.3330`,
};
