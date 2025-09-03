import { PatientData } from "../../domain/patient";
import { Contact } from "../../domain/contact";
import { normalizePhoneNumber } from "@metriport/shared";
import { normalizeEmail } from "../normalize-patient";

export function calculateContactScores(
  metriportPatient: PatientData,
  externalPatient: PatientData
): { phoneScore: number; emailScore: number } {
  return {
    phoneScore: calculatePhoneScore(metriportPatient, externalPatient),
    emailScore: calculateEmailScore(metriportPatient, externalPatient),
  };
}

function calculatePhoneScore(metriportPatient: PatientData, externalPatient: PatientData): number {
  const directMatch = metriportPatient.contact?.some(c1 =>
    externalPatient.contact?.some(c2 => {
      if (!c1.phone || !c2.phone) return false;
      return normalizePhoneNumber(c1.phone) === normalizePhoneNumber(c2.phone);
    })
  );

  return directMatch ? 2 : 0;
}

function calculateEmailScore(metriportPatient: PatientData, externalPatient: PatientData): number {
  const directMatch = metriportPatient.contact?.some(c1 =>
    externalPatient.contact?.some(c2 => {
      if (!c1.email || !c2.email) return false;
      return normalizeEmail(c1.email) === normalizeEmail(c2.email);
    })
  );

  return directMatch ? 2 : 0;
}

export function isContactMatch(contact1: Contact, contact2: Contact): boolean {
  const phoneMatch = Boolean(
    contact1.phone &&
      contact2.phone &&
      normalizePhoneNumber(contact1.phone) === normalizePhoneNumber(contact2.phone)
  );
  const emailMatch = Boolean(
    contact1.email &&
      contact2.email &&
      normalizeEmail(contact1.email) === normalizeEmail(contact2.email)
  );

  return phoneMatch || emailMatch;
}
