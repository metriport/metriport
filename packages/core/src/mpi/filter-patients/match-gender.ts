import { PatientData } from "../../domain/patient";

export function calculateGenderScore(
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  if (metriportPatient.genderAtBirth === externalPatient.genderAtBirth) {
    return 1;
  }

  return 0;
}
