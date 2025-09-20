import { Address } from "./address";
import { Patient } from "./patient";

/**
 * Regex to match invalid UTF-8 characters that should be stripped from patient data.
 * Currently targets the replacement character (�) which indicates corrupted encoding.
 */
const badCharactersRegex = /[�]/g;

/**
 * Strips invalid UTF-8 characters from a string.
 *
 * @param str - The string to sanitize
 * @returns The sanitized string with invalid characters removed, or undefined if input is falsy
 */
function stripBadCharactersFromString(str: string): string {
  return str.replace(badCharactersRegex, "");
}

/**
 * Strips invalid UTF-8 characters from patient address data.
 *
 * @param patient - The patient whose data should be sanitized
 * @returns A new patient object with sanitized address data
 */
export function stripInvalidCharactersFromPatientData(patient: Patient): Patient {
  if (!patient.data.address) return patient;

  return {
    ...patient,
    data: {
      ...patient.data,
      address: patient.data.address.map((address: Address) => ({
        ...address,
        addressLine1: stripBadCharactersFromString(address.addressLine1),
        ...(address.addressLine2
          ? { addressLine2: stripBadCharactersFromString(address.addressLine2) }
          : {}),
      })),
    },
  };
}
