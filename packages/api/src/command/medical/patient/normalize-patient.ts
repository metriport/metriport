import { PatientData, splitName } from "../../../domain/medical/patient";

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/['-]/g, "");
}

export const normalizePatientData = (patient: PatientData): PatientData => {
  const normalizedPatient: PatientData = {
    ...patient,
    // TODO: Handle the possibility of multiple patient names. right now we are just selecting for the first patient name.
    firstName: splitName(normalizeString(patient.firstName))[0],
    lastName: splitName(normalizeString(patient.lastName))[0],
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

/**
 * Normalizes an email address by removing leading and trailing spaces, converting all characters to lowercase,
 * and handling common domain typos.
 *
 * @param email - The email address to be normalized.
 * @returns The normalized email address.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalizes a phone number by removing all non-numeric characters and, if applicable, removing the country code.
 * @param phoneNumber - The phone number to be normalized.
 * @returns The normalized phone number as a string.
 */
function normalizePhoneNumber(phoneNumber: string): string {
  const normalizedNumber = phoneNumber.replace(/\D/g, "");

  if (normalizedNumber.startsWith("1") && normalizedNumber.length === 11) {
    return normalizedNumber.substring(1);
  }

  return normalizedNumber;
}

// default value detection. Null, John Doe, 000-000-0000
// override rules:
// if matching drivers license.
// should be indexed on this?
