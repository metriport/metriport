import { PatientData } from "../../domain/patient";
import { Contact } from "../../domain/contact";

export function calculateContactScores(
  metriportPatient: PatientData,
  externalPatient: PatientData
): { phoneScore: number; emailScore: number } {
  return {
    phoneScore: calculateScore("phone", metriportPatient, externalPatient),
    emailScore: calculateScore("email", metriportPatient, externalPatient),
  };
}

function calculateScore(
  field: "phone" | "email",
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  const directMatch = metriportPatient.contact?.some(c1 =>
    externalPatient.contact?.some(c2 => c1[field] && c2[field] && c1[field] === c2[field])
  );

  if (directMatch) return 2;

  return 0;
}

export function isContactMatch(contact1: Contact, contact2: Contact): boolean {
  const phoneMatch = Boolean(contact1.phone && contact2.phone && contact1.phone === contact2.phone);
  const emailMatch = Boolean(contact1.email && contact2.email && contact1.email === contact2.email);

  return phoneMatch || emailMatch;
}
