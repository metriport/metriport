import {
  toLowerCase,
  normalizeNonEmptyStringSafe,
  normalizeDateSafe,
  normalizeGenderSafe,
  normalizeUSStateForAddressSafe,
  normalizeStateSafe,
  normalizeZipCodeSafe,
  normalizeCountrySafe,
  normalizedCountryUsa,
  normalizePhoneSafe,
  normalizeEmailSafe,
  normalizeSsnSafe,
  commonReplacementsForAddressLine,
  USState,
} from "@metriport/shared";
import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import {
  ConsolidatedLinkDemographics,
  Patient,
  PersonalIdentifier,
  splitDob,
  splitName,
} from "@metriport/core/domain/patient";
import {
  LinkDemographics,
  LinkDemographicsComparison,
  LinkGenericAddress,
} from "@metriport/core/domain/patient-demographics";
import { mapMetriportGenderToFhirGender } from "@metriport/core/external/fhir/patient/conversion";

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
  const isMatched = score >= scoreThreshold;
  return isMatched
    ? { isMatched, comparison: matchedFields }
    : { isMatched, comparison: undefined };
}

/**
 * Converts a Patient's demographics into a normalized and stringified core demographics payload.
 *
 * @param patient The Patient @ Metriport.
 * @returns core demographics representing the Patient's demographics.
 */
export function patientToNormalizedCoreDemographics(patient: Patient): LinkDemographics {
  const dob = normalizeDateSafe(patient.data.dob);
  const gender = mapMetriportGenderToFhirGender(normalizeGenderSafe(patient.data.genderAtBirth));
  const patientFirstNames: string[] = splitName(patient.data.firstName);
  const patientLastNames: string[] = splitName(patient.data.lastName);
  const names = patientLastNames.flatMap(lastName => {
    return patientFirstNames.flatMap(firstName => {
      const normalizedNames = normalizeAndStringifyNames({ firstName, lastName });
      if (!normalizedNames) return [];
      return [normalizedNames];
    });
  });
  const addresses = patient.data.address.flatMap(address => {
    const normalizedAddress = normalizeAndStringfyAddress({
      line: [address.addressLine1, ...(address.addressLine2 ? [address.addressLine2] : [])],
      ...address,
    });
    if (!normalizedAddress) return [];
    return [normalizedAddress];
  });
  const telephoneNumbers = (patient.data.contact ?? []).flatMap(c => {
    if (!c.phone) return [];
    const normalizedPhone = normalizePhoneSafe(c.phone);
    if (!normalizedPhone) return [];
    return [normalizedPhone];
  });
  const emails = (patient.data.contact ?? []).flatMap(c => {
    if (!c.email) return [];
    const normalizedEmail = normalizeEmailSafe(c.email);
    if (!normalizedEmail) return [];
    return [normalizedEmail];
  });
  const driversLicenses = (patient.data.personalIdentifiers ?? []).flatMap(p => {
    if (p.type !== "driversLicense") return [];
    const normalizedDl = normalizeAndStringifyDriversLicense({ value: p.value, state: p.state });
    if (!normalizedDl) return [];
    return [normalizedDl];
  });
  const ssns = (patient.data.personalIdentifiers ?? []).flatMap(p => {
    if (p.type !== "ssn") return [];
    const normalizedSsn = normalizeSsnSafe(p.value);
    if (!normalizedSsn) return [];
    return [normalizedSsn];
  });
  return {
    dob,
    gender,
    names,
    addresses,
    telephoneNumbers,
    emails,
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
}): string | undefined {
  const normalizedFirstName = normalizeNonEmptyStringSafe(firstName, toLowerCase);
  if (!normalizedFirstName) return undefined;
  const normalizedLastName = normalizeNonEmptyStringSafe(lastName, toLowerCase);
  if (!normalizedLastName) return undefined;
  const normalizedName = {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
  };
  return JSON.stringify(normalizedName, Object.keys(normalizedName).sort());
}

export function normalizeAndStringfyAddress({
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
}): string | undefined {
  if (!line || !city || !state || !zip) return undefined;
  const normalizedLines = line.flatMap(l => {
    const normalizedLine = normalizeNonEmptyStringSafe(l, toLowerCase);
    if (!normalizedLine) return [];
    return [commonReplacementsForAddressLine(normalizedLine)];
  });
  if (normalizedLines.length === 0) return undefined;
  const normalizedCity = normalizeNonEmptyStringSafe(city, toLowerCase);
  if (!normalizedCity) return undefined;
  const normalizedState = normalizeUSStateForAddressSafe(state);
  if (!normalizedState) return undefined;
  const normalizedZip = normalizeZipCodeSafe(zip);
  if (!normalizedZip) return undefined;
  const normalizedCountry = normalizeCountrySafe(
    (country && country === "" ? normalizedCountryUsa : country) ?? normalizedCountryUsa
  );
  if (!normalizedCountry) return undefined;
  const normalizedAddress = {
    line: normalizedLines,
    city: normalizedCity,
    state: normalizedState.toLowerCase(),
    zip: normalizedZip,
    country: normalizedCountry.toLowerCase(),
  };
  return JSON.stringify(normalizedAddress, Object.keys(normalizedAddress).sort());
}

export function normalizeAndStringifyDriversLicense({
  value,
  state,
}: {
  value: string;
  state: string;
}): string | undefined {
  const normalizedValue = normalizeNonEmptyStringSafe(value, toLowerCase);
  if (!normalizedValue) return undefined;
  const normalizedState = normalizeStateSafe(state);
  if (!normalizedState) return undefined;
  const normalizedDl = {
    value: normalizedValue,
    state: normalizedState.toLowerCase(),
  };
  return JSON.stringify(normalizedDl, Object.keys(normalizedDl).sort());
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
  const newSsns: PersonalIdentifier[] = consolidatedLinkDemographics.ssns
    .filter(ssn => !coreDemographics.ssns.includes(ssn))
    .map(ssn => {
      return { type: "ssn", value: ssn };
    });
  const aupmentedPatient = {
    ...patient,
    data: {
      ...patient.data,
      contact: patient.data.contact
        ? [...patient.data.contact, ...newTelephoneNumbers, ...newEmails]
        : [...newTelephoneNumbers, ...newEmails],
      address: [...patient.data.address, ...newAddresses],
      personalIdentifiers: patient.data.personalIdentifiers
        ? [...patient.data.personalIdentifiers, ...newSsns]
        : [...newSsns],
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
