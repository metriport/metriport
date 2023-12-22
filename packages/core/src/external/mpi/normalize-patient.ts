import { PatientDataMPI, Address } from "./patient-incoming-schema";

// Define default values for each field
const defaultValues = {
  firstName: "john",
  lastName: "doe",
  address: [{ addressLine1: "123 main street", city: "anytown", zip: "00000" }],
  contact: [{ email: "example@example.com", phone: "0000000000" }],
};

/**
 * The function checks if a patient's address or name matches the default values and returns null if
 * they do, otherwise it updates the patient's contact information and returns the modified patient
 * object.
 * @param patient - The `patient` parameter is an object of type `Patient`. It
 * represents the data of a patient, including their address, name, and contact information.
 * @returns either a modified `Patient` object or `null`.
 */
function handleDefaultValues(patient: PatientDataMPI): PatientDataMPI | null {
  const isDefaultAddress = patient.address?.some(
    addr =>
      addr &&
      (addr.addressLine1 === defaultValues.address?.[0]?.addressLine1 ||
        addr.city === defaultValues.address?.[0]?.city ||
        addr.zip === defaultValues.address?.[0]?.zip)
  );

  const isDefaultName =
    patient.firstName === defaultValues.firstName && patient.lastName === defaultValues.lastName;

  if (isDefaultAddress || isDefaultName) {
    return null;
  }

  patient.contact = (patient.contact ?? []).map(contact => {
    const defaultContact = defaultValues.contact?.[0];
    if (!defaultContact) {
      return contact;
    }
    return {
      email: contact.email === defaultContact.email ? "" : contact.email,
      phone: contact.phone === defaultContact.phone ? "" : contact.phone,
    };
  });

  return patient;
}

/**
 * The function `normalizePatient` takes in patient data and normalizes it by splitting the first
 * and last names, normalizing email and phone numbers, and formatting the address.
 * @param patient - The `patient` parameter is an object that represents patient data. It
 * has the following properties:
 * @returns a normalized version of the patient data. If the patient data is valid, it will return the
 * normalized patient data as an object of type `Patient`. If the patient data is null, it will
 * return null.
 */
export function normalizePatientDataMPI(patient: PatientDataMPI): PatientDataMPI | null {
  // array destructuring to extract the first element of the array with defaults
  const [firstName = patient.firstName] = splitName(normalizeString(patient.firstName));
  const [lastName = patient.lastName] = splitName(normalizeString(patient.lastName));

  const normalizedPatient: PatientDataMPI = {
    ...patient,
    // TODO: Handle the possibility of multiple patient names. right now we are just selecting for the first patient name.
    firstName,
    lastName,
    contact: (patient.contact ?? []).map(contact => ({
      ...contact,
      email: contact.email ? normalizeEmail(contact.email) : contact.email,
      phone: contact.phone ? normalizePhoneNumber(contact.phone) : contact.phone,
    })),
    address: (patient.address ?? []).map(addr => {
      const newAddress: Address = {
        addressLine1: normalizeAddress(addr.addressLine1),
        city: normalizeString(addr.city),
        zip: addr.zip.slice(0, 5),
        state: addr.state,
        country: addr.country || "USA",
      };
      if (addr.addressLine2) {
        newAddress.addressLine2 = normalizeAddress(addr.addressLine2);
      }
      return newAddress;
    }),
  };
  return handleDefaultValues(normalizedPatient);
}

/**
 * The normalizeString function takes a string as input, removes leading and trailing whitespace,
 * converts all characters to lowercase, and removes any apostrophes or hyphens.
 * @param {string} str - The `str` parameter is a string that represents the input string that needs to
 * be normalized.
 * @returns a normalized version of the input string.
 */
function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/['-]/g, "");
}

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
    // applies to US and Canada numbers only
    return normalizedNumber.substring(1);
  }

  return normalizedNumber;
}

// TODO maybe want to have a rule that we will only normalize a single word in the address. If there are multiple, then
// we will not normalize. This is because we don't want to normalize something like "123 boulevard rd" to "123 blvd rd"

/**
 * The function `normalizeAddress` takes a string representing an address and replaces common street
 * suffixes with their abbreviated forms.
 * @param {string} address - The `address` parameter is a string that represents a street address.
 * @returns The function `normalizeAddress` returns a string.
 */
function normalizeAddress(address: string): string {
  const suffixes: Record<string, string> = {
    street: "st",
    avenue: "ave",
    boulevard: "blvd",
    drive: "dr",
    road: "rd",
    terrace: "ter",
    place: "pl",
    lane: "ln",
    highway: "hwy",
    parkway: "pkwy",
  };

  address = address.trim().toLowerCase().replace(/['-.]/g, "");
  const words: string[] = address.split(" ");

  const transformedWords = words.map(word => {
    const suffix = suffixes[word];
    return suffix ? suffix : word;
  });

  return transformedWords.join(" ");
}

export function splitName(name: string): string[] {
  // splits by comma delimiter and filters out empty strings
  return name.split(/[\s,]+/).filter(str => str);
}
