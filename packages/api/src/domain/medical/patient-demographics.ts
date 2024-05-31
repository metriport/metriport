import {
  Patient,
  splitName,
  splitDob,
  ConsolidatedLinkDemographics,
} from "@metriport/core/domain/patient";
import {
  LinkDemographics,
  LinkDemographicsDiff,
  LinkGender,
  LinkGenericAddress,
} from "@metriport/core/domain/patient-demographics";
import { Address } from "@metriport/core/domain/address";
import { Contact, stripNonNumericChars } from "@metriport/core/domain/contact";
import { USState } from "@metriport/core/domain/geographic-locations";
import { mapGenderAtBirthToFhir } from "@metriport/core/external/fhir/patient/index";
import dayjs from "dayjs";

const ISO_DATE = "YYYY-MM-DD";

/**
 * Evaluates whether the input linked demographcis are similar enough to the input patient demographics to be considered a demogrpahic "match".
 *
 * This function is modelled off of Epic's matching algorithm, which uses a point system for different matching demographics. Each exact
 * or partial match awards a certain number of points, which are added to an overall score. This score must be higher than the given threshold
 * (20 or 21 if SSNs are present) in order for the input linked demograhics to successfully "match".
 *
 * @param patientDemographics The patient LinkDemographics .
 * @param linkDemographics The incoming linked demographics from CQ or CW.
 * @returns boolean representing whether the linkDemographics "match" the patientDemographics.
 */
export function scoreLinkEpic(
  patientDemographics: LinkDemographics,
  linkDemographics: LinkDemographics
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
    const overlappingDateParts = linkedDobSplit.filter(dp => patientDobSplit.includes(dp));
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
  if (linkDemographics.names.some(name => patientDemographics.names.includes(name))) {
    score += 10;
  } else {
    // Names approximate match
    // TODO
  }
  // Address exact match
  if (linkDemographics.addressesString.some(a => patientDemographics.addressesString.includes(a))) {
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
  if (
    linkDemographics.telephoneNumbers.some(tn => patientDemographics.telephoneNumbers.includes(tn))
  ) {
    score += 2;
  } else {
    // Telephone approximate match
    // TODO
  }
  // Email exact match
  if (linkDemographics.emails.some(e => patientDemographics.emails.includes(e))) {
    score += 2;
  } else {
    // Email approximate match
    // TODO
  }
  if (linkDemographics.ssns.length > 0) scoreThreshold = 21;
  // SSN exact match
  if (linkDemographics.ssns.some(ssn => patientDemographics.ssns.includes(ssn))) {
    score += 5;
  } else {
    // SSN approximate match
    // TODO
  }
  return score >= scoreThreshold;
}

/**
 * Converts a Metriport Patient's demographics into a normalized and stringified LinkDemographics payload.
 * Currently general normalization: trim(), toLowerCase() for all strings, JSON.stringify for objects (sorted along keys) to convert to strings.
 * Special cases:
 * DOB: first 10 characters.
 * Telephone numbers and ssn: convert to numeric characters.
 * Gender: convert to "male", "female", "unknown".
 * Address: convert to LinkGenericAddress w/ zip to first 5 numeric characters.
 *
 * @param patient The Patient @ Metriport.
 * @returns LinkDemographics payload.
 */
export function patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics( // Too descriptive :)?
  patient: Patient
): LinkDemographics {
  const dob = normalizeDob(patient.data.dob);
  const gender = normalizeGender(patient.data.genderAtBirth);
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
  const addressesString = addressesObj.map(stringifyAddress);
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

export function normalizeDob(dob?: string): string {
  const parsedDate = dayjs(dob?.trim() ?? "", ISO_DATE, true);
  if (!parsedDate.isValid()) return "";
  return parsedDate.format(ISO_DATE);
}

export function normalizeGender(gender?: string): LinkGender {
  if (gender === "M" || gender === "F") {
    return mapGenderAtBirthToFhir(gender) as LinkGender;
  }
  const normalizeAndStringifydGender = gender?.trim().toLowerCase() ?? "";
  if (normalizeAndStringifydGender !== "male" && normalizeAndStringifydGender !== "female") {
    return "unknown";
  }
  return normalizeAndStringifydGender;
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
}): LinkGenericAddress {
  return {
    line:
      line?.map(l => {
        return l
          .trim()
          .toLowerCase()
          .replaceAll("street", "st")
          .replaceAll("drive", "dr")
          .replaceAll("road", "rd")
          .replaceAll("court", "ct")
          .replaceAll("avenue", "ave")
          .replaceAll("lane", "ln")
          .replaceAll("highway", "hwy")
          .replaceAll("east", "e")
          .replaceAll("west", "w")
          .replaceAll("north", "n")
          .replaceAll("south", "s");
      }) ?? [],
    city: city?.trim().toLowerCase() ?? "",
    state: state?.trim().toLowerCase() ?? "",
    zip: stripNonNumericChars(zip ?? "")
      .trim()
      .slice(0, 5),
    country:
      country
        ?.trim()
        .toLowerCase()
        .replaceAll("us", "usa")
        .replaceAll("united states", "usa")
        .slice(0, 3) ?? "usa",
  };
}

export function stringifyAddress(normalizedAddress: LinkGenericAddress): string {
  return JSON.stringify(normalizedAddress, Object.keys(normalizedAddress).sort());
}

export function normalizeTelephone(telephone: string): string {
  const numbersPhone = stripNonNumericChars(telephone);
  if (numbersPhone.length === 11 && numbersPhone[0] === "1") {
    return numbersPhone.slice(-10);
  }
  return numbersPhone;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

/**
 * Adds current Link demographics to the Patient to create the augmented Patient.
 *
 * @param patient The Patient @ Metriport.
 * @returns Patient augmented with the new linked data.
 */
export function createAugmentedPatient(patient: Patient): Patient {
  const coreDemographics =
    patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics(patient);
  const consolidatedLinkDemographics = patient.data.consolidatedLinkDemograhpics;
  if (!consolidatedLinkDemographics) return patient;
  // TODO Is submitting lower case addresses to CQ / CW okay, or do we have to grab the original version?
  const newAddresses: Address[] = consolidatedLinkDemographics.addressesString
    .filter(address => !coreDemographics.addressesString.includes(address))
    .map(address => {
      const addressObj: LinkGenericAddress = JSON.parse(address);
      return {
        addressLine1: addressObj.line[0] ?? "",
        addressLine2: addressObj.line[1] ? addressObj.line.slice(1).join(" ") : undefined,
        city: addressObj.city,
        state: addressObj.state as USState,
        zip: addressObj.zip,
        country: addressObj.country,
      };
    });
  const newTelephoneNumbers: Contact[] = consolidatedLinkDemographics.telephoneNumbers
    .filter(phone => !coreDemographics.telephoneNumbers.includes(phone))
    .map(phone => {
      return { phone };
    });
  const newEmails: Contact[] = consolidatedLinkDemographics.emails
    .filter(email => !coreDemographics.emails.includes(email))
    .map(email => {
      return { email };
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
 * Checks to see if the input Link demographics have any new values compared to the core Patient demographics and link Patient Demographics
 * Currently checks values for addresses, telephone numbers, and emails and considers a value new if it doesn't match exactly.
 *
 * @param patientDemographics The Patient LinkDemographics.
 * @param linkDemographics The Link LinkDemographics.
 * @returns boolean representing whether or not new values were found, and the diff if yes
 */
export function linkHasNewDemographiscData(
  coreDemographics: LinkDemographics,
  consolidatedLinkDemographics: ConsolidatedLinkDemographics | undefined,
  linkDemographics: LinkDemographics
): [boolean, LinkDemographicsDiff | undefined] {
  const hasNewDob = linkDemographics.dob !== coreDemographics.dob;
  const hasNewGender = linkDemographics.gender !== coreDemographics.gender;
  const newNames = linkDemographics.names.filter(
    name =>
      !coreDemographics.names.includes(name) &&
      !(consolidatedLinkDemographics?.names ?? []).includes(name)
  );
  const newAddresses = linkDemographics.addressesString.filter(
    address =>
      !coreDemographics.addressesString.includes(address) &&
      !(consolidatedLinkDemographics?.addressesString ?? []).includes(address)
  );
  const newTelephoneNumbers = linkDemographics.telephoneNumbers.filter(
    phone =>
      !coreDemographics.telephoneNumbers.includes(phone) &&
      !(consolidatedLinkDemographics?.telephoneNumbers ?? []).includes(phone)
  );
  const newEmails = linkDemographics.emails.filter(
    email =>
      !coreDemographics.emails.includes(email) &&
      !(consolidatedLinkDemographics?.emails ?? []).includes(email)
  );
  const newDriversLicenses = linkDemographics.driversLicenses.filter(
    dl =>
      !coreDemographics.driversLicenses.includes(dl) &&
      !(consolidatedLinkDemographics?.driversLicenses ?? []).includes(dl)
  );
  const newSsn = linkDemographics.ssns.filter(
    ssn =>
      !coreDemographics.ssns.includes(ssn) &&
      !(consolidatedLinkDemographics?.ssns ?? []).includes(ssn)
  );
  const hasNewDemographics =
    hasNewDob ||
    hasNewGender ||
    newNames.length > 0 ||
    newAddresses.length > 0 ||
    newTelephoneNumbers.length > 0 ||
    newEmails.length > 0 ||
    newDriversLicenses.length > 0 ||
    newSsn.length > 0;
  if (hasNewDemographics) {
    return [
      hasNewDemographics,
      {
        ...(hasNewDob ? { dob: linkDemographics.dob } : undefined),
        ...(hasNewGender ? { gender: linkDemographics.gender } : undefined),
        ...(newNames.length > 0 ? { names: newNames } : undefined),
        ...(newAddresses.length > 0 ? { addressesString: newAddresses } : undefined),
        ...(newTelephoneNumbers.length > 0 ? { telephoneNumbers: newTelephoneNumbers } : undefined),
        ...(newEmails.length > 0 ? { emails: newEmails } : undefined),
        ...(newDriversLicenses.length > 0 ? { driversLicenses: newDriversLicenses } : undefined),
        ...(newSsn.length > 0 ? { ssns: newSsn } : undefined),
      },
    ];
  }
  return [false, undefined];
}
