import {
  Patient,
  splitName,
  splitDob,
  ConsolidatedLinkDemographics,
} from "@metriport/core/domain/patient";
import {
  LinkDemographics,
  LinkDemographicsComparison,
  LinkDateOfBirth,
  LinkGender,
  LinkGenericAddress,
  LinkGenericName,
  LinkGenericDriversLicense,
} from "@metriport/core/domain/patient-demographics";
import { Address } from "@metriport/core/domain/address";
import { Contact, stripNonNumericChars } from "@metriport/core/domain/contact";
import { USState } from "@metriport/core/domain/geographic-locations";
import { mapGenderAtBirthToFhir } from "@metriport/core/external/fhir/patient/index";
import { ISO_DATE } from "../../shared/date";
import dayjs from "dayjs";

/**
 * Evaluates whether the input linked demographics are similar enough to the Patient to be considered a usable "match".
 *
 * This function uses a point system for different matching demographics. Each exact or partial match awards a
 * certain number of points, which are added to an overall score. This score must be higher than the given threshold
 * (20 or 21 if SSNs are present) in order for the input linked demograhics to be considered a usable "match".
 *
 * @param coreDemographics The patient core demographics.
 * @param linkDemographics The incoming link demographics from CQ or CW.
 * @returns boolean representing whether or not the link demographics match the patient, and the comparison object if yes.
 */
export function checkDemoMatch({
  coreDemographics,
  linkDemographics,
}: {
  coreDemographics: LinkDemographics;
  linkDemographics: LinkDemographics;
}):
  | { isMatched: true; comparison: LinkDemographicsComparison }
  | { isMatched: false; comparison: undefined } {
  const matchedFields: LinkDemographicsComparison = {};
  let scoreThreshold = 20;
  let score = 0;
  if (coreDemographics.dob && linkDemographics.dob) {
    if (coreDemographics.dob === linkDemographics.dob) {
      score += 8;
      matchedFields.dob = linkDemographics.dob;
    } else {
      // DOB approximate match
      const patientDobSplit = splitDob(coreDemographics.dob);
      const linkedDobSplit = splitDob(linkDemographics.dob);
      const overlappingDateParts = linkedDobSplit.filter(dp => patientDobSplit.includes(dp));
      if (overlappingDateParts.length >= 2) {
        score += 2;
        matchedFields.dob = linkDemographics.dob;
      }
    }
  }
  if (coreDemographics.gender && linkDemographics.gender) {
    // Gender exact match
    if (coreDemographics.gender === linkDemographics.gender) {
      score += 1;
      matchedFields.gender = linkDemographics.gender;
    } else {
      // Gender approximate match
      // TODO
    }
  }
  // Names exact match
  const overLapNames = linkDemographics.names.filter(name => coreDemographics.names.includes(name));
  if (overLapNames.length > 0) {
    score += 10;
    matchedFields.names = overLapNames;
  } else {
    // Names approximate match
    // TODO
  }
  // Address exact match
  const overLapAddress = linkDemographics.addresses.filter(a =>
    coreDemographics.addresses.includes(a)
  );
  if (overLapAddress.length > 0) {
    score += 2;
    matchedFields.addresses = overLapAddress;
  } else {
    // Address approximate match
    // TODO
    // Current address zip / city match
    // TODO Mark the first address as current in Dash
    if (coreDemographics.addresses.length > 0) {
      const currentPatientAddress = JSON.parse(coreDemographics.addresses[0]) as LinkGenericAddress;
      const linkDemograhpicsAddesses = linkDemographics.addresses.map(
        address => JSON.parse(address) as LinkGenericAddress
      );
      if (
        linkDemograhpicsAddesses.map(address => address.city).includes(currentPatientAddress.city)
      ) {
        score += 0.5;
        matchedFields.addresses = overLapAddress;
      }
      if (
        linkDemograhpicsAddesses.map(address => address.zip).includes(currentPatientAddress.zip)
      ) {
        score += 0.5;
        matchedFields.addresses = overLapAddress;
      }
    }
  }
  // Telephone exact match
  const overLapTelephone = linkDemographics.telephoneNumbers.filter(tn =>
    coreDemographics.telephoneNumbers.includes(tn)
  );
  if (overLapTelephone.length > 0) {
    score += 2;
    matchedFields.telephoneNumbers = overLapTelephone;
  } else {
    // Telephone approximate match
    // TODO
  }
  // Email exact match
  const overLapEmail = linkDemographics.emails.filter(e => coreDemographics.emails.includes(e));
  if (overLapEmail.length > 0) {
    score += 2;
    matchedFields.emails = overLapEmail;
  } else {
    // Email approximate match
    // TODO
  }
  if (linkDemographics.ssns.length > 0) scoreThreshold = 21;
  const overLapSsn = linkDemographics.ssns.filter(ssn => coreDemographics.ssns.includes(ssn));
  // SSN exact match
  if (overLapSsn.length > 0) {
    score += 5;
    matchedFields.ssns = overLapSsn;
  } else {
    // SSN approximate match
    // TODO
  }
  const isMatched = true || score >= scoreThreshold;
  return isMatched
    ? { isMatched, comparison: matchedFields }
    : { isMatched, comparison: undefined };
}

/**
 * Converts a Patient's demographics into a normalized and stringified core demographics payload.
 * Currently general normalization: trim(), toLowerCase() for all strings, JSON.stringify for objects (sorted along keys) to convert to strings.
 * Special cases: WIP.
 *
 * @param patient The Patient @ Metriport.
 * @returns core demographics representing the Patient's demographics.
 */
export function patientToNormalizedCoreDemographics(patient: Patient): LinkDemographics {
  const dob = normalizeDob(patient.data.dob);
  const gender = normalizeGender(patient.data.genderAtBirth);
  const patientFirstNames: string[] = splitName(patient.data.firstName);
  const patientLastNames: string[] = splitName(patient.data.lastName);
  const names = patientLastNames.flatMap(lastName => {
    return patientFirstNames.map(firstName => {
      return normalizeAndStringifyNames({ firstName, lastName });
    });
  });
  const addresses = patient.data.address.map(address => {
    return stringifyAddress(
      normalizeAddress({
        line: [address.addressLine1, ...(address.addressLine2 ? [address.addressLine2] : [])],
        ...address,
      })
    );
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
  return removeInvalidArrayValues({
    dob,
    gender,
    names,
    addresses,
    telephoneNumbers,
    emails,
    driversLicenses,
    ssns,
  });
}

/**
 * Removes values from core or link demographics that are incomplete.
 *
 * @param demographics The incoming core or link demographics.
 * @returns the input demographics with incomplete values removed.
 */
export function removeInvalidArrayValues(demographics: LinkDemographics): LinkDemographics {
  return {
    dob: demographics.dob,
    gender: demographics.gender,
    names: demographics.names.filter(name => {
      const nameObj: LinkGenericName = JSON.parse(name);
      return nameObj.firstName !== "" && nameObj.lastName !== "";
    }),
    addresses: demographics.addresses.filter(address => {
      const addressObj: LinkGenericAddress = JSON.parse(address);
      return addressObj.line.length > 0 && addressObj.city !== "" && addressObj.zip !== "";
    }),
    telephoneNumbers: demographics.telephoneNumbers.filter(tn => tn !== ""),
    emails: demographics.emails.filter(email => email !== ""),
    driversLicenses: demographics.driversLicenses.filter(dl => {
      const dlObj: LinkGenericDriversLicense = JSON.parse(dl);
      return dlObj.value !== "" && dlObj.state !== "";
    }),
    ssns: demographics.ssns.filter(ssn => ssn !== ""),
  };
}

export function normalizeDob(dob?: string): LinkDateOfBirth {
  const normalDob = dob?.trim() ?? "";
  const parsedDate = dayjs(normalDob);
  if (parsedDate.isValid()) return parsedDate.format(ISO_DATE);
  return undefined;
}

export function normalizeGender(gender?: string): LinkGender {
  if (gender === "M" || gender === "F") {
    return mapGenderAtBirthToFhir(gender) as LinkGender;
  }
  const normalizeAndStringifydGender = gender?.trim().toLowerCase() ?? "";
  if (normalizeAndStringifydGender !== "male" && normalizeAndStringifydGender !== "female") {
    return undefined;
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
      line
        ?.filter(l => l !== "")
        .map(l => {
          return l
            .trim()
            .toLowerCase()
            .replaceAll("street", "st")
            .replaceAll("drive", "dr")
            .replaceAll("road", "rd")
            .replaceAll("avenue", "ave");
        }) ?? [],
    city: city?.trim().toLowerCase() ?? "",
    state: state?.trim().toLowerCase().slice(0, 2) ?? "",
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
  return stripNonNumericChars(telephone).slice(-10);
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
    state: state.trim().toLowerCase().slice(0, 2),
  };
  return JSON.stringify(normalizedDl, Object.keys(normalizedDl).sort());
}

export function normalizeSsn(ssn: string): string {
  return stripNonNumericChars(ssn).slice(-9);
}

/**
 * Adds current patient consolidated link demographics to the Patient's demographics to create the augmented Patient.
 *
 * @param patient The Patient @ Metriport.
 * @returns Patient augmented with the consolidated link demographics.
 */
export function createAugmentedPatient(patient: Patient): Patient {
  const coreDemographics = patientToNormalizedCoreDemographics(patient);
  const consolidatedLinkDemographics = patient.data.consolidatedLinkDemographics;
  if (!consolidatedLinkDemographics) return patient;
  // TODO Is submitting lower case addresses to CQ / CW okay, or do we have to grab the original version?
  const newAddresses: Address[] = consolidatedLinkDemographics.addresses
    .filter(address => !coreDemographics.addresses.includes(address))
    .map(address => {
      const addressObj: LinkGenericAddress = JSON.parse(address);
      return {
        addressLine1: addressObj.line[0],
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
 * Checks to see if the input link demographics has any new values compared to the patient core demographics and consolidated link demographics.
 * Currently checks values exactly.
 *
 * @param coreDemographics The patient core demographics.
 * @param linkDemographics The incoming link demographics from CQ or CW.
 * @param consolidatedLinkDemographics The patient consolidated link demographics history.
 * @returns boolean representing whether or not the link demographics has new values, and the comparison if yes.
 */
export function linkHasNewDemographics({
  coreDemographics,
  linkDemographics,
  consolidatedLinkDemographics,
}: {
  coreDemographics: LinkDemographics;
  linkDemographics: LinkDemographics;
  consolidatedLinkDemographics?: ConsolidatedLinkDemographics;
}):
  | { hasNewDemographics: true; comparison: LinkDemographicsComparison }
  | { hasNewDemographics: false; comparison: undefined } {
  const hasNewDob =
    coreDemographics.dob && linkDemographics.dob && linkDemographics.dob !== coreDemographics.dob;
  const hasNewGender =
    coreDemographics.gender &&
    linkDemographics.gender &&
    linkDemographics.gender !== coreDemographics.gender;
  const newNames = linkDemographics.names.filter(
    name =>
      !coreDemographics.names.includes(name) &&
      !(consolidatedLinkDemographics?.names ?? []).includes(name)
  );
  const hasNewNames = newNames.length > 0;
  const newAddresses = linkDemographics.addresses.filter(
    address =>
      !coreDemographics.addresses.includes(address) &&
      !(consolidatedLinkDemographics?.addresses ?? []).includes(address)
  );
  const hasNewAddresses = newAddresses.length > 0;
  const newTelephoneNumbers = linkDemographics.telephoneNumbers.filter(
    phone =>
      !coreDemographics.telephoneNumbers.includes(phone) &&
      !(consolidatedLinkDemographics?.telephoneNumbers ?? []).includes(phone)
  );
  const hasNewTelephoneNumbers = newTelephoneNumbers.length > 0;
  const newEmails = linkDemographics.emails.filter(
    email =>
      !coreDemographics.emails.includes(email) &&
      !(consolidatedLinkDemographics?.emails ?? []).includes(email)
  );
  const hasNewEmails = newEmails.length > 0;
  const newDriversLicenses = linkDemographics.driversLicenses.filter(
    dl =>
      !coreDemographics.driversLicenses.includes(dl) &&
      !(consolidatedLinkDemographics?.driversLicenses ?? []).includes(dl)
  );
  const hasNewDriversLicenses = newDriversLicenses.length > 0;
  const newSsn = linkDemographics.ssns.filter(
    ssn =>
      !coreDemographics.ssns.includes(ssn) &&
      !(consolidatedLinkDemographics?.ssns ?? []).includes(ssn)
  );
  const hasNewSsn = newSsn.length > 0;
  const hasNewDemographics =
    hasNewDob ||
    hasNewGender ||
    hasNewNames ||
    hasNewAddresses ||
    hasNewTelephoneNumbers ||
    hasNewEmails ||
    hasNewDriversLicenses ||
    hasNewSsn;
  if (hasNewDemographics) {
    return {
      hasNewDemographics,
      comparison: {
        ...(hasNewDob ? { dob: linkDemographics.dob } : undefined),
        ...(hasNewGender ? { gender: linkDemographics.gender } : undefined),
        ...(hasNewNames ? { names: newNames } : undefined),
        ...(hasNewAddresses ? { addresses: newAddresses } : undefined),
        ...(hasNewTelephoneNumbers ? { telephoneNumbers: newTelephoneNumbers } : undefined),
        ...(hasNewEmails ? { emails: newEmails } : undefined),
        ...(hasNewDriversLicenses ? { driversLicenses: newDriversLicenses } : undefined),
        ...(hasNewSsn ? { ssns: newSsn } : undefined),
      },
    };
  }
  return { hasNewDemographics, comparison: undefined };
}

/**
 * Combines checkDemoMatch and linkHasNewDemographics to return the set of link demographics with usable new data.
 *
 * @param patient The Patient @ Metriport.
 * @param links The incoming link demographics from CQ or CW converted from their raw state.
 * @returns the set of link demographics that pass checkDemoMatch and pass linkHasNewDemographics
 */
export function getNewDemographics(
  patient: Patient,
  links: LinkDemographics[]
): LinkDemographics[] {
  const coreDemographics = patientToNormalizedCoreDemographics(patient);
  const consolidatedLinkDemographics = patient.data.consolidatedLinkDemographics;
  return links
    .filter(linkDemographics => checkDemoMatch({ coreDemographics, linkDemographics }).isMatched)
    .filter(
      linkDemographics =>
        linkHasNewDemographics({
          coreDemographics,
          linkDemographics,
          consolidatedLinkDemographics,
        }).hasNewDemographics
    );
}
