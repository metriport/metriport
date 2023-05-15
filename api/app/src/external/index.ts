export enum MedicalDataSource {
  COMMONWELL = "COMMONWELL",
}

export const HL7OID = "2.16.840.1.113883";

export const MedicalDataSourceOid: Record<MedicalDataSource, string> = {
  [MedicalDataSource.COMMONWELL]: "2.16.840.1.113883.3.3330",
};
