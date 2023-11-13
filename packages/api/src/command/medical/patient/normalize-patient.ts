import { PatientData, splitName } from "../../../domain/medical/patient";

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/['-]/g, "");
}

// Define default values for each field
// const defaultValues: { [key in keyof PatientData]?: any } = {
//   address: [{ addressLine1: "123 Main Street", city: "anytown" }],
//   contact: [{ email: "example@example.com", phone: "000-000-0000" }],
//   // Add default values for other fields as needed
// };

// function handleDefaultValues(patient: PatientData): PatientData | null {
//   // Iterate over each property of the patient object
//   for (const key in patient) {
//     if (Array.isArray(patient[key])) {
//       patient[key as keyof PatientData] = patient[key].map((item, index) => {
//         for (const subKey in item) {
//           const typedItem = item as { [key: string]: any };
//           if (defaultValues[key] && defaultValues[key][index] && defaultValues[key][index][subKey] === typedItem[subKey]) {
//             if (typedItem[subKey] && typedItem[subKey] !== "") {
//               return null;
//             }
//           }
//         }
//         return item;
//       });
//     } else if (defaultValues[key] && typeof patient[key] === 'string' && defaultValues[key].includes(patient[key])) {
//       if (patient[key] && patient[key] !== "") {
//         return null;
//       } else {
//         patient[key as keyof PatientData] = "";
//       }
//     }
//   }

//   return patient;
// }

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
// 123 Main Street
// anytown
// N/A
// example@example.com
// 000-000-0000
// 00000 for zip
