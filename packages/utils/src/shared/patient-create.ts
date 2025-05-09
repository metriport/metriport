import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Address, Contact, PatientCreate } from "@metriport/api-sdk";
import fs from "fs";

export function dedupPatientCreates(patients: PatientCreate[]): PatientCreate[] {
  const { uniquePatients } = dedupPatientCreatesReturnDuplicates(patients);
  return uniquePatients;
}
export function dedupPatientCreatesReturnDuplicates(patients: PatientCreate[]): {
  uniquePatients: PatientCreate[];
  duplicates: PatientCreate[][];
} {
  const patientMap = new Map<string, PatientCreate>();
  const duplicates: PatientCreate[][] = [];
  patients.forEach(patient => {
    const nameKey = `${patient.firstName} ${patient.lastName} ${patient.dob} ${patient.genderAtBirth}`;
    // const nameKey = `${patient.externalId}`;
    const existing = patientMap.get(nameKey);
    if (existing) {
      duplicates.push([existing, patient]);
      const mergedPatient = mergePatients(existing, patient);
      patientMap.set(nameKey, mergedPatient);
    } else {
      patientMap.set(nameKey, patient);
    }
  });
  return {
    uniquePatients: Array.from(patientMap.values()),
    duplicates,
  };
}

export function mergePatients(p1: PatientCreate, p2: PatientCreate): PatientCreate {
  const addresses = [
    ...(Array.isArray(p1.address) ? p1.address : [p1.address]),
    ...(Array.isArray(p2.address) ? p2.address : [p2.address]),
  ];
  const uniqueAddresses = deduplicateAddresses(addresses);

  const contacts = [
    ...(Array.isArray(p1.contact) ? p1.contact : p1.contact ? [p1.contact] : []),
    ...(Array.isArray(p2.contact) ? p2.contact : p2.contact ? [p2.contact] : []),
  ];
  const uniqueContacts = deduplicateContacts(contacts);

  return {
    ...p1,
    address: [uniqueAddresses[0], ...uniqueAddresses.slice(1)],
    contact: uniqueContacts,
  };
}

export function deduplicateAddresses(addresses: Address[]): Address[] {
  const uniqueMap = new Map<string, Address>();

  addresses.forEach(addr => {
    const key = `${addr.addressLine1}|${addr.addressLine2 ?? ""}|${addr.city}|${addr.state}|${
      addr.zip
    }`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, addr);
    }
  });

  return Array.from(uniqueMap.values());
}

export function deduplicateContacts(contacts: Contact[]): Contact[] {
  // Split contacts into separate phone and email arrays
  const phones = contacts.filter(c => c.phone).map(c => ({ phone: c.phone }));
  const emails = contacts.filter(c => c.email).map(c => ({ email: c.email }));
  // Deduplicate phones and emails separately
  const uniquePhones = Array.from(new Set(phones.map(p => p.phone))).map(phone => ({ phone }));
  const uniqueEmails = Array.from(new Set(emails.map(e => e.email))).map(email => ({ email }));
  // Merge phones and emails into combined contacts, matching by array position
  const maxLength = Math.max(uniquePhones.length, uniqueEmails.length);
  const deduplicatedContacts = Array.from({ length: maxLength }, (_, i) => ({
    ...(uniquePhones[i] ?? {}),
    ...(uniqueEmails[i] ?? {}),
  }));
  return deduplicatedContacts;
}

export function storePatientCreates(
  patientCreate: PatientCreate[] | PatientCreate[][],
  fileName: string
) {
  if (patientCreate.length < 1) return;
  if (!Array.isArray(patientCreate[0])) {
    const contents = JSON.stringify(patientCreate, null, 2);
    fs.appendFileSync(fileName, contents);
    return;
  }
  const patientCreateArr = patientCreate as PatientCreate[][];
  const contents =
    `[\n` +
    patientCreateArr
      .map(p => {
        return `\t[\n` + p.map(p => JSON.stringify(p)).join(",\n") + `\n\t]`;
      })
      .join(",\n") +
    `\n]`;
  fs.appendFileSync(fileName, contents);
}
