import { splitDob } from "../../domain/patient";
import { PatientData } from "../../domain/patient";

export function calculateDobScore(
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  if (metriportPatient.dob === externalPatient.dob) {
    return 8;
  } else {
    const dob1Split = splitDob(metriportPatient.dob);
    const dob2Split = splitDob(externalPatient.dob);

    let matchingParts = 0;
    if (dob1Split[0] && dob2Split[0] && dob1Split[0] === dob2Split[0]) matchingParts++; // Year
    if (dob1Split[1] && dob2Split[1] && dob1Split[1] === dob2Split[1]) matchingParts++; // Month
    if (dob1Split[2] && dob2Split[2] && dob1Split[2] === dob2Split[2]) matchingParts++; // Day

    return Math.min(matchingParts, 2);
  }
}
