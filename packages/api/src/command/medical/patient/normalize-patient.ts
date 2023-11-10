import { PatientData } from "../../../domain/medical/patient";

const commonDomainTypos: { [key: string]: string } = {
  "gamil.com": "gmail.com",
  // add more common typos here
};

export const normalizePatientData = (patient: PatientData): PatientData => {
  const normalizedPatient: PatientData = {
    ...patient,
    firstName: patient.firstName.toLowerCase().replace(/['-]/g, ""),
    lastName: patient.lastName.toLowerCase().replace(/['-]/g, ""),
    contact: patient.contact?.map(contact => ({
      ...contact,
      email: contact.email ? normalizeEmail(contact.email) : contact.email,
      phone: contact.phone ? normalizePhoneNumber(contact.phone) : contact.phone,
    })),
    address: patient.address.map(addr => ({
      ...addr,
      line1: addr.addressLine1
        ? addr.addressLine1.toLowerCase().replace(/['-]/g, "")
        : addr.addressLine1,
      line2: addr.addressLine2
        ? addr.addressLine2.toLowerCase().replace(/['-]/g, "")
        : addr.addressLine2,
      city: addr.city ? addr.city.toLowerCase().replace(/['-]/g, "").replace(/\s/g, "") : addr.city,
      zip: addr.zip.slice(0, 5),
    })),
  };
  return normalizedPatient;
};

function normalizeEmail(email: string): string {
  let normalizedEmail = email.trim().toLowerCase();
  // this needs to be better, but a lot of record linkage does email normalization
  const domain = normalizedEmail.split("@")[1];
  if (commonDomainTypos[domain]) {
    normalizedEmail = normalizedEmail.replace(domain, commonDomainTypos[domain]);
  }
  return normalizedEmail;
}

// normalize phones
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-numeric characters
  let normalizedNumber = phoneNumber.replace(/\D/g, "");
  // Check if the number starts with '1' which is the country code for US/Canada
  if (normalizedNumber.startsWith("1") && normalizedNumber.length === 11) {
    // Remove the country code
    normalizedNumber = normalizedNumber.substring(1);
  }
  return normalizedNumber;
}

// default value detection. Null, John Doe, 000-000-0000

// override rules:
// if matching drivers license.
// should be indexed on this?
