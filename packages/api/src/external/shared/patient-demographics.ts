import { Patient, splitName, splitDob } from "@metriport/core/domain/patient";
import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { USState } from "@metriport/core/domain/geographic-locations";

type LinkDemoDataAddress = {
  line?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

export type LinkDemoData = {
  dob?: string;
  gender?: string;
  names: {
    firstName: string;
    lastName: string;
  }[];
  telephoneNumbers: string[];
  emails: string[];
  addresses: LinkDemoDataAddress[];
  driversLicenses: {
    value: string;
    state: string;
  }[];
  ssns: string[];
};

export function scoreLink(
  patientDemographics: LinkDemoData,
  linkDemographics: LinkDemoData
): boolean {
  let scoreThreshold = 20;
  let score = 0;
  // DOB exact match
  if (patientDemographics.dob === linkDemographics.dob) score += 8;
  // DOB approximate match
  if (patientDemographics.dob && linkDemographics.dob) {
    const patientDobSplit = splitDob(patientDemographics.dob);
    const linkedDobSplit = splitDob(linkDemographics.dob);
    if (linkedDobSplit.filter(patientDobSplit.includes).length > 2) score += 2;
  }
  // Gender exact match
  if (patientDemographics.gender && linkDemographics.gender) {
    if (patientDemographics.gender === linkDemographics.gender) score += 1;
  }
  // Names exact match
  if (linkDemographics.names.some(patientDemographics.names.includes)) score += 10;
  // Names approximate match
  // TODO
  // Address exact match
  // TODO Mark the first address as current in Dash
  const overlappingAddresses = linkDemographics.addresses.filter(a =>
    patientDemographics.addresses.includes(a)
  );
  score += 2 * overlappingAddresses.length;
  const currentPatientAddress = patientDemographics.addresses[0];
  if (currentPatientAddress) {
    if (linkDemographics.addresses.map(a => a.city).includes(currentPatientAddress.city))
      score += 0.5;
    if (linkDemographics.addresses.map(a => a.zip).includes(currentPatientAddress.zip))
      score += 0.5;
  }
  // Address approximate match
  // TODO
  // Telephone exact match
  const overlappingTelephone = linkDemographics.telephoneNumbers.filter(a =>
    patientDemographics.telephoneNumbers.includes(a)
  );
  score += 2 * overlappingTelephone.length;
  // Telephone approximate match
  // TODO
  // Emails approximate match
  const overlappinEmail = linkDemographics.emails.filter(a =>
    patientDemographics.emails.includes(a)
  );
  score += 2 * overlappinEmail.length;
  // SSN exact match
  if (linkDemographics.ssns.length > 0) scoreThreshold = 21;
  const overlappingSsn = linkDemographics.ssns.filter(a => patientDemographics.ssns.includes(a));
  if (overlappingSsn.length > 0) score += 5;
  // SSN approximate match
  // TODO
  return score >= scoreThreshold;
}

export function patientToLinkedDemoData(patient: Patient): LinkDemoData {
  const dob = patient.data.dob;
  const gender = patient.data.genderAtBirth;
  const patientFirstNames: string[] = splitName(patient.data.firstName);
  const patientLastNames: string[] = splitName(patient.data.lastName);
  const names = patientLastNames.flatMap(lastName => {
    return patientFirstNames.map(firstName => {
      return { firstName, lastName };
    });
  });
  const telephoneNumbers = (patient.data.contact ?? []).flatMap(c => {
    if (!c.phone) return [];
    return [c.phone];
  });
  const emails = (patient.data.contact ?? []).flatMap(c => {
    if (!c.email) return [];
    return [c.email];
  });
  const addresses = patient.data.address.map(a => {
    return {
      line: `${a.addressLine1} ${a.addressLine2}`,
      city: a.city,
      state: a.state as string,
      zip: a.zip,
      country: a.country ?? "USA",
    };
  });
  const driversLicenses = (patient.data.personalIdentifiers ?? []).flatMap(p => {
    if (p.type !== "driversLicense") return [];
    return { value: p.value, state: p.state };
  });
  const ssns = (patient.data.personalIdentifiers ?? []).flatMap(p => {
    if (p.type !== "ssn") return [];
    return [p.value];
  });
  return {
    dob,
    gender,
    names,
    telephoneNumbers,
    emails,
    addresses,
    driversLicenses,
    ssns,
  };
}

export function createAugmentedPatient(
  existingPatient: Patient,
  linksDempgraphics: LinkDemoData[]
): Patient {
  const newAddresses: Address[] = linksDempgraphics.flatMap(ld => {
    return ld.addresses.map(a => {
      const lineSplit = (a.line ?? "").split(" ");
      return {
        addressLine1: lineSplit[0] ?? "",
        addressLine2: lineSplit[1] ? lineSplit.slice(1).join(" ") : undefined,
        city: a.city ?? "",
        state: (a.state ?? "") as USState,
        zip: a.zip ?? "",
        country: a.country,
      };
    });
  });
  const newTelephoneNumbers: Contact[] = linksDempgraphics.flatMap(ld => {
    return ld.telephoneNumbers.map(phone => {
      return { phone };
    });
  });
  const newEmails: Contact[] = linksDempgraphics.flatMap(ld => {
    return ld.emails.map(email => {
      return { email };
    });
  });
  const aupmentedPatient = {
    ...existingPatient,
    data: {
      ...existingPatient.data,
      contact: existingPatient.data.contact
        ? [...existingPatient.data.contact, ...newTelephoneNumbers, ...newEmails]
        : [...newTelephoneNumbers, ...newEmails],
      address: [...existingPatient.data.address, ...newAddresses],
    },
  };
  return aupmentedPatient;
}

function createAddressString(a: LinkDemoDataAddress) {
  return `${a.line ?? ""} ${a.city ?? ""} ${a.state ?? ""} ${a.zip ?? ""} ${a.country ?? "USA"}`;
}

export function linkHasNewDemographicData(
  patientDemographics: LinkDemoData,
  linkDemographics: LinkDemoData
): boolean {
  // Address
  const hashedPatientAddresses = patientDemographics.addresses.map(createAddressString);
  const hashedLinkAddresses = linkDemographics.addresses.map(createAddressString);
  const hasNewAddress = hashedLinkAddresses.some(a => !hashedPatientAddresses.includes(a));
  // Telephone
  const hasNewTelephoneNumber = linkDemographics.telephoneNumbers.some(
    tn => !patientDemographics.telephoneNumbers.includes(tn)
  );
  return hasNewAddress || hasNewTelephoneNumber;
}
