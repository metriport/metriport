export enum MedicalDataSource {
  /**
   * @deprecated There's no HIE called "ALL", we should accept a list of HIEs instead when needed.
   */
  ALL = "ALL",
  COMMONWELL = "COMMONWELL",
  CAREQUALITY = "CAREQUALITY",
}

export function isMedicalDataSource(s?: string | null): s is MedicalDataSource {
  if (!s) return false;
  const list = Object.values(MedicalDataSource) as string[];
  return list.includes(s);
}

export const HL7OID = "2.16.840.1.113883";

type ValidMedicalDataSourceOid = Exclude<
  MedicalDataSource,
  MedicalDataSource.ALL | MedicalDataSource.CAREQUALITY
>;

export const MedicalDataSourceOid: Record<ValidMedicalDataSourceOid, string> = {
  [MedicalDataSource.COMMONWELL]: `${HL7OID}.3.3330`,
};
