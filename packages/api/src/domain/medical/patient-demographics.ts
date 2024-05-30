import { Patient, splitName, splitDob } from "@metriport/core/domain/patient";
import { Address } from "@metriport/core/domain/address";
import { Contact, stripNonNumericChars } from "@metriport/core/domain/contact";
import { USState } from "@metriport/core/domain/geographic-locations";
import { mapGenderAtBirthToFhir } from "@metriport/core/external/fhir/patient/index";

export type LinkDemoDataGender = "male" | "female" | "unknown";

export type GenericAddress = {
  line: string[];
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type LinkDemoData = {
  dob: string;
  gender: LinkDemoDataGender;
  names: string[];
  telephoneNumbers: string[];
  emails: string[];
  addressesObj: GenericAddress[];
  addressesString: string[];
  driversLicenses: string[];
  ssns: string[];
};

/**
 * Evaluates whether the input linked demographcis are similar enough to the input patient demographics to be considered a demogrpahic "match".
 *
 * This function is modelled off of Epic's matching algorithm, which uses a point system for different matching demographics. Each exact
 * or partial match awards a certain number of points, which are added to an overall score. This score must be higher than the given threshold
 * (20 or 21 if SSNs are present) in order for the input linked demograhics to successfully "match".
 *
 * @param patientDemographics The patient LinkDemoData .
 * @param linkDemographics The incoming linked demographics from CQ or CW.
 * @returns boolean representing whether the linkDemographics "match" the patientDemographics.
 */
export function scoreLinkEpic(
  patientDemographics: LinkDemoData,
  linkDemographics: LinkDemoData
): boolean {
  let scoreThreshold = 20;
  let score = 0;
  // DOB exact match
  if (patientDemographics.dob === linkDemographics.dob) {
    score += 8;
  } else {
    // DOB approximate match
    const patientDobSplit = splitDob(patientDemographics.dob);
    const linkedDobSplit = splitDob(linkDemographics.dob);
    const overlappingDateParts = linkedDobSplit.filter(patientDobSplit.includes);
    if (overlappingDateParts.length >= 2) {
      score += 2;
    }
  }
  // Gender exact match
  if (
    patientDemographics.gender !== "unknown" &&
    linkDemographics.gender !== "unknown" &&
    patientDemographics.gender === linkDemographics.gender
  ) {
    score += 1;
  } else {
    // Gender approximate match
    // TODO
  }
  // Names exact match
  if (linkDemographics.names.some(patientDemographics.names.includes)) {
    score += 10;
  } else {
    // Names approximate match
    // TODO
  }
  // Address exact match
  if (linkDemographics.addressesString.some(patientDemographics.addressesString.includes)) {
    score += 2;
    // Address approximate match
    // TODO
  } else {
    // Address current address zip / city match
    // TODO Mark the first address as current in Dash
    const currentPatientAddress = patientDemographics.addressesObj[0];
    if (
      currentPatientAddress &&
      currentPatientAddress.city &&
      linkDemographics.addressesObj
        .map(address => address.city)
        .filter(city => city !== "")
        .includes(currentPatientAddress.city)
    ) {
      score += 0.5;
    }
    if (
      currentPatientAddress &&
      currentPatientAddress.zip &&
      linkDemographics.addressesObj
        .map(address => address.zip)
        .filter(zip => zip !== "")
        .includes(currentPatientAddress.zip)
    ) {
      score += 0.5;
    }
  }
  // Telephone exact match
  if (linkDemographics.telephoneNumbers.some(patientDemographics.telephoneNumbers.includes)) {
    score += 2;
  } else {
    // Telephone approximate match
    // TODO
  }
  // Email exact match
  if (linkDemographics.emails.some(patientDemographics.emails.includes)) {
    score += 2;
  } else {
    // Email approximate match
    // TODO
  }
  if (linkDemographics.ssns.length > 0) scoreThreshold = 21;
  // SSN exact match
  if (linkDemographics.ssns.some(patientDemographics.ssns.includes)) {
    score += 5;
  } else {
    // SSN approximate match
    // TODO
  }
  return score >= scoreThreshold;
}

/**
 * Converts a Metriport Patient's demographics into a normalized and stringified LinkDemoData payload.
 * Currently general normalization: trim(), toLowerCase() for all strings, JSON.stringify for objects (sorted along keys) to convert to strings.
 * Special cases:
 * Telephone numbers and ssn: convert to numeric characters.
 * Gender: convert to "male", "female", "unknown".
 * Address: convert to GenericAddress.
 *
 * @param patient The Patient @ Metriport.
 * @returns LinkDemoData payload.
 */
export function patientToNormalizedAndStringLinkedDemoData(patient: Patient): LinkDemoData {
  const dob = normalizeDob(patient.data.dob);
  const gender = normalizeGender(mapGenderAtBirthToFhir(patient.data.genderAtBirth));
  const patientFirstNames: string[] = splitName(patient.data.firstName);
  const patientLastNames: string[] = splitName(patient.data.lastName);
  const names = patientLastNames.flatMap(lastName => {
    return patientFirstNames.map(firstName => {
      return normalizeAndStringifyNames({ firstName, lastName });
    });
  });
  const addressesObj = patient.data.address.map(address => {
    return normalizeAddress({
      line: [address.addressLine1, ...(address.addressLine2 ? [address.addressLine2] : [])],
      ...address,
    });
  });
  const addressesString = addressesObj.map(addressObj => {
    return stringifyAddress(addressObj);
  });
  const telephoneNumbers = (patient.data.contact ?? []).flatMap(c => {
    if (!c.phone) return [];
    return [normalizeTelephone(c.phone)];
  });
  const emails = (patient.data.contact ?? []).flatMap(c => {
    if (!c.email) return [];
    return [normalizeEmail(c.email)];
  });
  const driversLicenses = (patient.data.personalIdentifiers ?? []).flatMap(p => {
    if (p.type !== "driversLicense") return [];
    return [normalizeAndStringifyDriversLicense({ value: p.value, state: p.state })];
  });
  const ssns = (patient.data.personalIdentifiers ?? []).flatMap(p => {
    if (p.type !== "ssn") return [];
    return [normalizeSsn(p.value)];
  });
  return {
    dob,
    gender,
    names,
    telephoneNumbers,
    emails,
    addressesObj,
    addressesString,
    driversLicenses,
    ssns,
  };
}

export function normalizeAndStringifyNames({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  const normalizedName = {
    firstName: firstName.trim().toLowerCase(),
    lastName: lastName.trim().toLowerCase(),
  };
  return JSON.stringify(normalizedName, Object.keys(normalizedName).sort());
}

export function normalizeAddress({
  line,
  city,
  state,
  zip,
  country,
}: {
  line?: string[];
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): GenericAddress {
  return {
    line: line?.map(l => l.trim().toLowerCase()) ?? [],
    city: city?.trim().toLowerCase() ?? "",
    state: state?.trim().toLowerCase() ?? "",
    zip: zip?.trim() ?? "",
    country: country?.trim().toLowerCase() ?? "",
  };
}

export function stringifyAddress(normalizedAddress: GenericAddress): string {
  return JSON.stringify(normalizedAddress, Object.keys(normalizedAddress).sort());
}

export function normalizeAndStringifyDriversLicense({
  value,
  state,
}: {
  value: string;
  state: string;
}): string {
  const normalizedDl = {
    value: value.trim().toLowerCase(),
    state: state.trim().toLowerCase(),
  };
  return JSON.stringify(normalizedDl, Object.keys(normalizedDl).sort());
}

export function normalizeSsn(ssn: string): string {
  return stripNonNumericChars(ssn);
}

export function normalizeTelephone(telephone: string): string {
  return stripNonNumericChars(telephone);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDob(dob?: string): string {
  return dob?.trim() ?? "";
}

export function normalizeGender(gender?: string): LinkDemoDataGender {
  const normalizeAndStringifydGender = gender?.trim().toLowerCase() ?? "";
  if (normalizeAndStringifydGender !== "male" && normalizeAndStringifydGender !== "female")
    return "unknown";
  return normalizeAndStringifydGender;
}

/**
 * Adds new Link demographics to the Patient to create the augmented Patient.
 *
 * @param patient The Patient @ Metriport.
 * @param linksDempgraphics A list of Link LinkDemoData to augment the Patient with.
 * @returns Patient augmented with the new linked data.
 */
export function createAugmentedPatient(
  patient: Patient,
  linksDempgraphics: LinkDemoData[]
): Patient {
  const patientDemographics = patientToNormalizedAndStringLinkedDemoData(patient);
  // TODO Is submitting lower case addresses to CQ / CW okay, or do we have to grab the original version?
  const newAddresses: Address[] = linksDempgraphics.flatMap(ld => {
    return ld.addressesString
      .filter(address => !patientDemographics.addressesString.includes(address))
      .map(address => {
        const addressObj: GenericAddress = JSON.parse(address);
        return {
          addressLine1: addressObj.line[0] ?? "",
          addressLine2: addressObj.line[1] ? addressObj.line.slice(1).join(" ") : undefined,
          city: addressObj.city,
          state: addressObj.state as USState,
          zip: addressObj.zip,
          country: addressObj.country,
        };
      });
  });
  const newTelephoneNumbers: Contact[] = linksDempgraphics.flatMap(ld => {
    return ld.telephoneNumbers
      .filter(phone => !patientDemographics.telephoneNumbers.includes(phone))
      .map(phone => {
        return { phone };
      });
  });
  const newEmails: Contact[] = linksDempgraphics.flatMap(ld => {
    return ld.emails
      .filter(email => !patientDemographics.emails.includes(email))
      .map(email => {
        return { email };
      });
  });
  const aupmentedPatient = {
    ...patient,
    data: {
      ...patient.data,
      contact: patient.data.contact
        ? [...patient.data.contact, ...newTelephoneNumbers, ...newEmails]
        : [...newTelephoneNumbers, ...newEmails],
      address: [...patient.data.address, ...newAddresses],
    },
  };
  return aupmentedPatient;
}

/**
 * Checks to see if the input Link demographics have any new values compared to the Patient demographics.
 * Currently checks values for addresses, telephone numbers, and emails and considers a value new if it doesn't match exactly.
 *
 * @param patientDemographics The Patient LinkDemoData.
 * @param linkDemographics The Link LinkDemoData.
 * @returns boolean representing whether or not new values were found.
 */
export function linkHasNewDemographicData(
  patientDemographics: LinkDemoData,
  linkDemographics: LinkDemoData
): boolean {
  const hasNewAddress = linkDemographics.addressesString.some(
    address => !patientDemographics.addressesString.includes(address)
  );
  const hasNewTelephoneNumber = linkDemographics.telephoneNumbers.some(
    phone => !patientDemographics.telephoneNumbers.includes(phone)
  );
  const hasNewEmail = linkDemographics.emails.some(
    email => !patientDemographics.emails.includes(email)
  );
  return hasNewAddress || hasNewTelephoneNumber || hasNewEmail;
}
