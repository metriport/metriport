import { PatientData } from "../../domain/patient";

export function calculateSsnScore(
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  const ssn1 = metriportPatient.personalIdentifiers
    ?.filter(id => id.type === "ssn")
    .flatMap(id => id.value || []);
  const ssn2 = externalPatient.personalIdentifiers
    ?.filter(id => id.type === "ssn")
    .flatMap(id => id.value || []);

  if (ssn1?.length && ssn2?.length) {
    const ssnMatch = ssn1.some(s1 => ssn2.includes(s1));
    if (ssnMatch) {
      return 5;
    }
  }

  return 0;
}

export function hasSsnData(metriportPatient: PatientData, externalPatient: PatientData): boolean {
  const ssn1 = metriportPatient.personalIdentifiers?.filter(id => id.type === "ssn");
  const ssn2 = externalPatient.personalIdentifiers?.filter(id => id.type === "ssn");
  return !!(ssn1?.length && ssn2?.length);
}
