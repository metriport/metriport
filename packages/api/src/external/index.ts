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

type ValidMedicalDataSourceOid = Exclude<MedicalDataSource, MedicalDataSource.CAREQUALITY>;

export const MedicalDataSourceOid: Record<ValidMedicalDataSourceOid, string> = {
  [MedicalDataSource.COMMONWELL]: `${HL7OID}.3.3330`,
};
